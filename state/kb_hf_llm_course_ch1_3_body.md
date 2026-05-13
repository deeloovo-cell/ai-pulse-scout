Transformers, what can they do?

这一节是 Hugging Face LLM Course 对 Transformer 实际用途的入门展示。文章核心不是解释底层原理，而是先让读者直观看到：Transformer 模型已经覆盖文本、图像、音频乃至多模态任务，而 `transformers` 库里的 `pipeline()` 提供了一个非常低门槛的统一接口，把预处理、模型推理和后处理串起来。作者通过情感分类、零样本分类、文本生成、掩码填充、命名实体识别、问答、摘要、翻译、图像分类和语音识别等例子，说明同一套抽象如何快速调用不同任务能力。整体上，这一节的价值在于帮助初学者先建立“Transformer 能做什么”的全景视图，再进入后续的机制分析。

EN: In this section, we will look at what Transformer models can do and use our first tool from the Transformers library: the `pipeline()` function.
ZH: 这一节会先看 Transformer 模型能做什么，并首次使用 `transformers` 库中的 `pipeline()` 工具。

EN: Transformer models are used to solve all kinds of tasks across different modalities, including natural language processing, computer vision, audio processing, and more.
ZH: Transformer 模型已经被用于处理多种模态的任务，包括自然语言处理、计算机视觉、音频处理等。

EN: The Transformers library provides the functionality to create and use those shared models, while the Model Hub contains millions of pretrained models that anyone can download and use.
ZH: `Transformers` 库提供了创建和使用这些共享模型的能力，而 Model Hub 则汇集了数百万个任何人都可以下载使用的预训练模型。

EN: The most basic object in the Transformers library is the `pipeline()` function.
ZH: `Transformers` 库中最基础、最重要的对象之一就是 `pipeline()` 函数。

EN: It connects a model with its necessary preprocessing and postprocessing steps, allowing us to directly input any text and get an intelligible answer.
ZH: 它把模型与所需的预处理、后处理步骤连接起来，让我们可以直接输入文本并得到可读的结果。

EN: There are three main steps involved when you pass some text to a pipeline: preprocessing the text, passing inputs to the model, and post-processing the predictions.
ZH: 当文本进入一个 pipeline 时，通常会经历三个步骤：预处理、送入模型推理，以及对预测结果进行后处理。

EN: The `pipeline()` function supports multiple modalities, allowing you to work with text, images, audio, and even multimodal tasks.
ZH: `pipeline()` 不只支持文本，也支持图像、音频，甚至多模态任务。

EN: Text pipelines include text generation, text classification, summarization, translation, zero-shot classification, and feature extraction.
ZH: 文本类 pipeline 包括文本生成、文本分类、摘要、翻译、零样本分类和特征提取等。

EN: Image pipelines include image-to-text, image classification, and object detection.
ZH: 图像类 pipeline 包括图像转文本、图像分类和目标检测。

EN: Audio pipelines include automatic speech recognition, audio classification, and text-to-speech.
ZH: 音频类 pipeline 包括自动语音识别、音频分类和文本转语音。

EN: Multimodal pipelines can respond to an image based on a text prompt.
ZH: 多模态 pipeline 则可以根据文本提示来理解或响应图像内容。

EN: The `zero-shot-classification` pipeline is powerful because it lets you classify text with your own labels without fine-tuning on task-specific data.
ZH: `zero-shot-classification` 很强大，因为它允许你不做任务微调，直接用自己定义的标签来分类文本。

EN: The `text-generation` pipeline takes a prompt and auto-completes it by generating the remaining text.
ZH: `text-generation` pipeline 的用法是给定一个提示词，然后让模型自动续写后面的文本。

EN: You can control the number of generated sequences with `num_return_sequences` and the output length with `max_length`.
ZH: 你可以用 `num_return_sequences` 控制生成多少条结果，用 `max_length` 控制输出长度。

EN: You are not limited to default models; you can choose any compatible model from the Hub for a given task.
ZH: 你并不局限于任务默认模型，也可以为某个任务从 Hub 中指定任意兼容模型。

EN: All the models can also be tested directly in the browser through Hugging Face Inference Providers.
ZH: 此外，很多模型还可以直接通过 Hugging Face 的 Inference Providers 在浏览器中在线测试。

EN: The `fill-mask` pipeline predicts missing words in a sentence by filling in a special mask token.
ZH: `fill-mask` pipeline 会根据上下文预测句子中被掩盖掉的位置，用候选词补全空缺。

EN: The `ner` pipeline identifies entities such as persons, organizations, and locations in text.
ZH: `ner` pipeline 用于识别文本中的实体，例如人物、组织和地点。

EN: The `question-answering` pipeline extracts answers from a provided context rather than generating them freely.
ZH: `question-answering` pipeline 是从给定上下文中抽取答案，而不是自由生成答案。

EN: Summarization reduces a long text into a shorter one while keeping the important points.
ZH: 摘要任务的目标是把长文本压缩成更短的版本，同时尽量保留关键信息。

EN: Translation pipelines can use either task-specific defaults or a chosen translation model from the Hub.
ZH: 翻译任务既可以使用带语言方向的默认模型，也可以手动指定 Hub 上的翻译模型。

EN: Beyond text, Transformer pipelines also support image classification and automatic speech recognition.
ZH: 除了文本，Transformer pipeline 也支持图像分类和自动语音识别等任务。

EN: One powerful application is combining data from multiple sources and formats into a unified response.
ZH: Transformer 的一个强大应用方向，是把多个来源、多个格式的数据整合成统一结果。

EN: The pipelines in this chapter are mostly for demonstration; they are task-specific and not yet flexible enough to perform arbitrary variations.
ZH: 本章展示的这些 pipeline 主要用于演示，它们通常针对特定任务设计，还不能灵活应对各种自由变化的需求。

EN: In the next chapter, you'll learn what is inside a `pipeline()` function and how to customize its behavior.
ZH: 下一章会进一步拆解 `pipeline()` 内部到底做了什么，以及如何对它进行定制。