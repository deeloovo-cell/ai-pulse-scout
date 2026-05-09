#!/usr/bin/env python3
import argparse
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

HEADER_ALIASES = {
    "name": ["姓名", "人员姓名", "成员姓名", "员工姓名"],
    "role": ["岗位", "职位", "岗位名称"],
    "org": ["二级部门", "二级组织", "二级机构", "部门", "组织"],
    "start": ["开始日期", "任务开始日期", "jira任务开始日期", "开始时间"],
    "end": ["结束日期", "任务结束日期", "jira任务结束日期", "结束时间"],
    "plan": ["计划工时", "计划工时(天)", "计划天数", "任务计划天数", "预估工时", "预估天数"],
}

ROLE_ALIAS_PRESETS = {
    "analyst": {"需求分析师", "业务分析师"},
}


def col_to_num(col: str) -> int:
    n = 0
    for ch in str(col).strip().upper():
        if "A" <= ch <= "Z":
            n = n * 26 + (ord(ch) - 64)
    return n


def excel_col(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def normalize_header(value):
    s = str(value or "").strip().lower()
    s = re.sub(r"\s+", "", s)
    s = s.replace("（", "(").replace("）", ")")
    return s


def detect_columns(header_row):
    normalized = {col: normalize_header(value) for col, value in header_row.items()}
    result = {}
    for field, aliases in HEADER_ALIASES.items():
        alias_set = {normalize_header(a) for a in aliases}
        exact_matches = [col for col, value in normalized.items() if value in alias_set]
        if exact_matches:
            result[field] = min(exact_matches)
            continue
        fuzzy_matches = []
        for col, value in normalized.items():
            if not value:
                continue
            if any(alias in value or value in alias for alias in alias_set):
                fuzzy_matches.append(col)
        if fuzzy_matches:
            result[field] = min(fuzzy_matches)
    return result


def resolve_column(args_value, detected, field_name):
    if args_value:
        return col_to_num(args_value)
    if field_name in detected:
        return detected[field_name]
    raise ValueError(f"required column missing: {field_name}")


def common_prefix_len(a: str, b: str) -> int:
    size = 0
    for x, y in zip(a, b):
        if x != y:
            break
        size += 1
    return size


def suggest_values(target: str, values):
    nt = normalize_header(target)
    scored = []
    for value in values:
        nv = normalize_header(value)
        score = 0
        if nt in nv or nv in nt:
            score += 100
        score += common_prefix_len(nt, nv)
        if score > 0:
            scored.append((score, value))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [value for _, value in scored[:5]]


def parse_date(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    try:
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=float(s))).date()
    except Exception:
        return None


def workdays(start: date, end: date):
    d = start
    out = []
    while d <= end:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def future_two_workweeks(today: date):
    d = today + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    days = []
    while len(days) < 10:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days[0], days[-1]


def load_workbook(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"file not found: {path}")
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: "xl/" + rel.attrib["Target"] for rel in rels}
        sheets = []
        for s in wb.find("a:sheets", NS):
            rid = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            sheets.append((s.attrib.get("name"), relmap[rid]))
        archive = {name: z.read(name) for name in z.namelist()}
        return shared, sheets, archive


def read_sheet_rows(path: Path, sheet_name=None):
    shared, sheets, archive = load_workbook(path)
    if not sheets:
        raise ValueError("no sheets found")
    selected = None
    if sheet_name:
        for name, target in sheets:
            if name == sheet_name:
                selected = (name, target)
                break
        if not selected:
            raise ValueError(f"sheet not found: {sheet_name}")
    else:
        selected = sheets[0]
    _, target = selected
    root = ET.fromstring(archive[target])
    rows = []
    for row in root.findall(".//a:sheetData/a:row", NS):
        values = {}
        for c in row.findall("a:c", NS):
            ref = c.attrib.get("r", "")
            m = re.match(r"([A-Z]+)(\d+)", ref)
            if not m:
                continue
            col = col_to_num(m.group(1))
            t = c.attrib.get("t")
            v = c.find("a:v", NS)
            if t == "s" and v is not None and v.text is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(t2.text or "" for t2 in c.findall(".//a:t", NS))
            elif v is not None and v.text is not None:
                val = v.text
            else:
                val = ""
            values[col] = val
        rows.append(values)
    return rows


def aggregate_person_day(
    rows,
    name_col,
    role_col,
    start_col,
    end_col,
    plan_col,
    start_date,
    end_date,
    threshold,
    exclude_resigned,
    org_col=None,
    org_value=None,
    role_alias_preset=None,
):
    target_days = workdays(start_date, end_date)
    target_set = set(target_days)
    person_day = defaultdict(float)
    person_role = {}
    allowed_roles = ROLE_ALIAS_PRESETS.get(role_alias_preset, set()) if role_alias_preset else None

    for row in rows[1:]:
        name = str(row.get(name_col, "")).strip()
        if not name:
            continue
        if exclude_resigned and "离职" in name:
            continue
        role = str(row.get(role_col, "")).strip() or "未填写"
        if allowed_roles is not None and role not in allowed_roles:
            continue
        if org_col is not None and org_value is not None:
            current_org = str(row.get(org_col, "")).strip()
            if current_org != org_value:
                continue
        person_role.setdefault(name, role)
        start = parse_date(row.get(start_col, ""))
        end = parse_date(row.get(end_col, ""))
        plan_raw = str(row.get(plan_col, "")).strip()
        if not start or not end or not plan_raw:
            continue
        try:
            plan = float(plan_raw)
        except Exception:
            continue
        if end < start_date or start > end_date:
            continue
        days = workdays(start, end)
        if not days:
            continue
        per_day = plan / len(days)
        for d in days:
            if d in target_set:
                person_day[(name, d)] += per_day

    results = []
    for name, role in person_role.items():
        lows = []
        total = 0.0
        for d in target_days:
            value = person_day.get((name, d), 0.0)
            if value < threshold:
                lows.append((d, value))
                total += value
        if lows:
            results.append(
                {
                    "姓名": name,
                    "岗位": role,
                    "低于阈值的工作日数": len(lows),
                    "这些日期工时合计": round(total, 4),
                    "具体日期": "；".join(f"{d.isoformat()}（{value:.2f}）" for d, value in lows),
                    "_lows": lows,
                }
            )
    return target_days, results


def sort_results(results, sort_key):
    if sort_key == "low_days_desc":
        results.sort(key=lambda x: (-x["低于阈值的工作日数"], x["这些日期工时合计"], x["姓名"]))
    elif sort_key == "name_asc":
        results.sort(key=lambda x: x["姓名"])
    elif sort_key == "hours_asc":
        results.sort(key=lambda x: (x["这些日期工时合计"], -x["低于阈值的工作日数"], x["姓名"]))
    else:
        raise ValueError(f"unsupported sort: {sort_key}")


def preview_lines(results, top=None):
    selected = results[:top] if top else results
    lines = []
    for idx, row in enumerate(selected, start=1):
        lines.append(
            "\t".join(
                [
                    str(idx),
                    row["姓名"],
                    row["岗位"],
                    str(row["低于阈值的工作日数"]),
                    f"{row['这些日期工时合计']:.2f}",
                    row["具体日期"],
                ]
            )
        )
    return lines


def build_export_rows(target_days, results):
    headers = ["姓名", "岗位", "低于阈值的工作日数", "这些日期工时合计", "具体日期"] + [d.isoformat() for d in target_days]
    rows = []
    for row in results:
        values = [row["姓名"], row["岗位"], row["低于阈值的工作日数"], row["这些日期工时合计"], row["具体日期"]]
        low_map = {d.isoformat(): round(v, 4) for d, v in row["_lows"]}
        values.extend(low_map.get(d.isoformat(), "") for d in target_days)
        rows.append(values)
    return headers, rows


def xml_cell(ref, value):
    if value is None or value == "":
        return f'<c r="{ref}" t="inlineStr"><is><t></t></is></c>'
    if isinstance(value, (int, float)):
        return f'<c r="{ref}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'


def write_xlsx(output_path: Path, headers, rows, sheet_name="低于阈值明细"):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    all_rows = [headers] + rows
    xml_rows = []
    for i, row in enumerate(all_rows, start=1):
        cells = []
        for j, value in enumerate(row, start=1):
            cells.append(xml_cell(f"{excel_col(j)}{i}", value))
        xml_rows.append(f'<row r="{i}">' + "".join(cells) + "</row>")
    last_col = excel_col(len(headers))
    last_row = len(all_rows)
    cols = [
        '<col min="1" max="1" width="14" customWidth="1"/>',
        '<col min="2" max="2" width="18" customWidth="1"/>',
        '<col min="3" max="4" width="14" customWidth="1"/>',
        '<col min="5" max="5" width="120" customWidth="1"/>',
        f'<col min="6" max="{len(headers)}" width="12" customWidth="1"/>' if len(headers) >= 6 else "",
    ]
    sheet_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:{last_col}{last_row}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>{''.join(cols)}</cols>
  <sheetData>{''.join(xml_rows)}</sheetData>
</worksheet>'''
    workbook_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="{escape(sheet_name)}" sheetId="1" r:id="rId1"/></sheets></workbook>'''
    wb_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
    now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    core = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>OpenClaw</dc:creator><cp:lastModifiedBy>OpenClaw</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified><dc:title>{escape(sheet_name)}</dc:title></cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>OpenClaw</Application></Properties>'''
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app)
        z.writestr("xl/workbook.xml", workbook_xml)
        z.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        z.writestr("xl/styles.xml", styles)
        z.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def build_parser():
    parser = argparse.ArgumentParser(description="Query IT plan-hours Excel data")
    parser.add_argument("--file", required=True)
    parser.add_argument("--sheet")
    parser.add_argument("--name-col")
    parser.add_argument("--role-col")
    parser.add_argument("--org-col")
    parser.add_argument("--start-col")
    parser.add_argument("--end-col")
    parser.add_argument("--plan-col")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--threshold-hours", type=float)
    parser.add_argument("--start-date")
    parser.add_argument("--end-date")
    parser.add_argument("--exclude-resigned", action="store_true")
    parser.add_argument("--role-alias", choices=sorted(ROLE_ALIAS_PRESETS.keys()))
    parser.add_argument("--org-value")
    parser.add_argument("--sort", default="low_days_desc")
    parser.add_argument("--top", type=int)
    parser.add_argument("--export")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        file_path = Path(args.file)
        rows = read_sheet_rows(file_path, args.sheet)
        if not rows:
            raise ValueError("sheet has no rows")
        detected = detect_columns(rows[0])
        if args.start_date and args.end_date:
            start_date = parse_date(args.start_date)
            end_date = parse_date(args.end_date)
        else:
            start_date, end_date = future_two_workweeks(date.today())
        if not start_date or not end_date:
            raise ValueError("date parse failure for start-date/end-date")
        if end_date < start_date:
            raise ValueError("end date is earlier than start date")
        threshold = args.threshold_hours / 8.0 if args.threshold_hours is not None else args.threshold
        name_col = resolve_column(args.name_col, detected, "name")
        role_col = resolve_column(args.role_col, detected, "role")
        start_col = resolve_column(args.start_col, detected, "start")
        end_col = resolve_column(args.end_col, detected, "end")
        plan_col = resolve_column(args.plan_col, detected, "plan")
        org_col = None
        org_value = None
        if args.org_value is not None:
            org_col = resolve_column(args.org_col, detected, "org")
            org_values = sorted({str(row.get(org_col, "")).strip() for row in rows[1:] if str(row.get(org_col, "")).strip()})
            if args.org_value in org_values:
                org_value = args.org_value
            else:
                suggestions = suggest_values(args.org_value, org_values)
                if suggestions:
                    raise ValueError(f"organization not found: {args.org_value}; did you mean: {', '.join(suggestions)}")
                raise ValueError(f"organization not found: {args.org_value}")
        target_days, results = aggregate_person_day(
            rows=rows,
            name_col=name_col,
            role_col=role_col,
            start_col=start_col,
            end_col=end_col,
            plan_col=plan_col,
            start_date=start_date,
            end_date=end_date,
            threshold=threshold,
            exclude_resigned=args.exclude_resigned,
            org_col=org_col,
            org_value=org_value,
            role_alias_preset=args.role_alias,
        )
        sort_results(results, args.sort)
        print("RANGE", start_date.isoformat(), end_date.isoformat())
        print("COUNT", len(results))
        for line in preview_lines(results, args.top):
            print(line)
        if args.export:
            headers, export_rows = build_export_rows(target_days, results)
            write_xlsx(Path(args.export), headers, export_rows)
            print("EXPORT", args.export)
        return 0
    except Exception as exc:
        print(f"ERROR\t{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
