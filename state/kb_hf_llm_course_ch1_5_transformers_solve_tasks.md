PARTIAL RETRIEVAL — The source page is accessible, but the fetched body was truncated by the extractor length limit. The note below is based on the retrieved substantive portion and should be treated as a partial capture rather than the complete page.

How 🤗 Transformers solve tasks

这篇 Hugging Face LLM Course 的章节，核心任务是把一个常见误解拆开：Transformer 并不是只会“做 NLP”，也不是每个任务都靠完全不同的机制完成。作者想说明的是，虽然不同任务表面上差异很大——文本分类、问答、摘要、翻译、语音识别、图像分类、目标检测等等——但它们在 Transformer 框架下往往遵循同一个抽象模式：先把输入编码成模型能处理的表示，再通过不同的结构变体（encoder、decoder、encoder-decoder）和 task head，把这些表示转换成任务需要的输出。真正变化的，是输入如何准备、模型哪一部分被使用、以及输出如何解释，而不是每个任务都要重新发明一套底层逻辑。

这篇文章最重要的价值，不是逐一背模型名，而是建立一个“任务—架构—输出头”之间的映射感。比如：需要双向理解上下文的任务通常偏向 encoder-only；需要逐 token 续写的任务通常偏向 decoder-only；需要把一个序列变成另一个序列的任务则更适合 encoder-decoder。作者借 BERT、GPT-2、BART、Whisper 等模型，把这种映射讲清楚：BERT 通过 masked language modeling 学会双向表示，所以适合分类、token labeling 和抽取式问答；GPT-2 通过 causal language modeling 学会从左到右预测下一个 token，因此天然适合生成；BART 通过“破坏输入再重建”的 seq2seq 预训练方式，特别适合摘要和翻译；Whisper 则说明同样的 Transformer 思路并不局限于文本，音频也可以先转换为适合建模的表示，再由 encoder-decoder 输出文本。

从学习路径上看，这一章其实是在帮读者建立“见到新模型时该怎么快速理解它”的框架。先问三件事：输入是什么形式、模型主体是哪种 Transformer 结构、最后接了什么输出头。很多任务差异，其实只是最后那层目标函数和输出解释方式不同。理解了这一点，再去看各种新模型，就不会只停留在记名字，而会更自然地判断：这个任务需要双向上下文吗？需要自回归生成吗？需要 source-to-target 的变换吗？这也是 Hugging Face 这门课最擅长的地方——不是只讲概念，而是把“怎么选模型、怎么理解模型为什么适合某任务”讲成一个可以迁移的思维方式。

EN: The chapter explains that many Transformer-based tasks share the same high-level pattern.
ZH: 这一章说明，很多基于 Transformer 的任务，在高层抽象上其实共享同一种处理模式。

EN: Input data is prepared, passed through a model architecture, and then interpreted through a task-specific output layer.
ZH: 输入数据先被整理成合适表示，再送进模型结构，最后通过任务特定的输出层解释成结果。

EN: The core differences between tasks often lie in data preparation, architecture choice, and output processing.
ZH: 不同任务之间的核心差异，往往落在数据准备、架构选择和输出处理上。

EN: For language models, the article divides Transformer architectures into encoder-only, decoder-only, and encoder-decoder categories.
ZH: 对语言模型来说，文章把 Transformer 架构分成 encoder-only、decoder-only 和 encoder-decoder 三大类。

EN: Encoder-only models like BERT are best for tasks that require deep bidirectional understanding.
ZH: 像 BERT 这样的 encoder-only 模型，最适合需要深度双向理解的任务。

EN: Decoder-only models like GPT-2 are best for left-to-right generation tasks.
ZH: 像 GPT-2 这样的 decoder-only 模型，更适合从左到右逐步生成的任务。

EN: Encoder-decoder models like BART and T5 are best for sequence-to-sequence transformations.
ZH: 像 BART 和 T5 这样的 encoder-decoder 模型，则更适合序列到序列的变换任务。

EN: The article contrasts two major language-model pretraining objectives: masked language modeling and causal language modeling.
ZH: 文中还对比了两种主要语言模型预训练目标：masked language modeling 和 causal language modeling。

EN: Masked language modeling lets the model infer missing tokens from both left and right context.
ZH: masked language modeling 让模型利用左右两侧上下文去推断被遮住的 token。

EN: Causal language modeling makes the model predict the next token from previous tokens only.
ZH: causal language modeling 则要求模型只根据前文预测下一个 token。

EN: This difference strongly shapes what a model becomes naturally good at.
ZH: 这种差异会深刻影响一个模型天然擅长什么任务。

EN: GPT-2 is used as the decoder-only example for text generation.
ZH: 文章用 GPT-2 作为 decoder-only 文本生成的代表例子。

EN: It tokenizes input, adds positional information, runs masked self-attention in decoder blocks, and predicts the next token.
ZH: 它会先把输入切成 token、加入位置信息，再经过 decoder block 里的 masked self-attention，最后预测下一个 token。

EN: Because it never attends to future tokens, GPT-2 fits causal generation naturally.
ZH: 因为它不会看到未来 token，所以非常适合因果式文本生成。

EN: BERT is used as the encoder-only example for text classification, token classification, and question answering.
ZH: BERT 则被用来说明 encoder-only 如何服务文本分类、token 分类和问答等任务。

EN: BERT uses special tokens like [CLS] and [SEP], along with token, position, and segment embeddings.
ZH: BERT 会使用 [CLS]、[SEP] 等特殊 token，并结合 token、位置与 segment embedding。

EN: Its pretraining combines masked language modeling and next-sentence prediction.
ZH: 它的预训练结合了 masked language modeling 与 next-sentence prediction。

EN: Once pretrained, BERT can be adapted to multiple tasks by attaching different heads on top of the hidden states.
ZH: 预训练完成后，只需在隐藏状态之上接不同 head，BERT 就能迁移到多种任务。

EN: For text classification, the [CLS] representation can feed a sequence classification head.
ZH: 对文本分类来说，[CLS] 表示可以送进 sequence classification head。

EN: For token classification, each token representation can feed a token-level classifier.
ZH: 对 token 分类来说，每个 token 的表示都可以送进 token-level classifier。

EN: For extractive question answering, the model predicts start and end spans over the context.
ZH: 对抽取式问答来说，模型则预测答案在上下文中的起止位置。

EN: The article emphasizes how little needs to change once a powerful pretrained encoder already exists.
ZH: 文章强调，一旦有了足够强的预训练 encoder，真正需要改变的部分其实很少。

EN: BART is used as the encoder-decoder example for summarization and translation.
ZH: BART 则被用作摘要与翻译这类任务中的 encoder-decoder 例子。

EN: Its pretraining strategy corrupts input text and trains the model to reconstruct the original sequence.
ZH: 它的预训练方法是先破坏输入文本，再训练模型恢复原始序列。

EN: Text infilling is highlighted as a particularly effective corruption strategy.
ZH: 文中特别提到 text infilling 是一种效果很好的破坏策略。

EN: This setup makes BART especially suitable for tasks that transform one sequence into another.
ZH: 这种训练方式让 BART 特别适合把一个序列转换成另一个序列的任务。

EN: Translation is presented as another sequence-to-sequence task, with multilingual variants like mBART extending the idea.
ZH: 翻译也被视作另一种 sequence-to-sequence 任务，而 mBART 之类的多语言变体则把这个思路扩展到了多语种场景。

EN: The chapter then broadens the discussion beyond text to other modalities.
ZH: 接着，这一章把讨论从文本扩展到了其他模态。

EN: Transformers are introduced as a general architecture that can also handle speech, audio, vision, and more.
ZH: 作者说明，Transformer 是一种通用架构，也可以处理语音、音频、视觉等任务。

EN: Whisper is used as an example of an encoder-decoder Transformer for speech tasks.
ZH: Whisper 被拿来作为语音任务中的 encoder-decoder Transformer 例子。

EN: Audio is first converted into a log-Mel spectrogram, encoded, and then decoded autoregressively into text tokens.
ZH: 音频会先被转换成 log-Mel spectrogram，再经过编码，最后由 decoder 自回归地产生文本 token。

EN: The article stresses that Whisper's large-scale weakly supervised pretraining is what gives it strong zero-shot performance.
ZH: 文章强调，Whisper 强大的 zero-shot 表现，关键来自其大规模弱监督预训练。

EN: A major takeaway of the chapter is that model choice becomes easier when you think in terms of architectural fit.
ZH: 这一章的一个重要结论是：如果你从“架构适配性”来思考，模型选择会容易很多。

EN: Ask whether the task needs bidirectional understanding, autoregressive generation, or sequence transformation.
ZH: 先问自己：这个任务需要双向理解、自回归生成，还是序列变换？

EN: That question often points directly to the right family of models.
ZH: 这个问题往往会直接把你指向正确的一类模型。

EN: The chapter is therefore less about memorizing model names and more about building transferable intuition.
ZH: 所以这一章真正想建立的，并不是“背模型名字”，而是一种可迁移的直觉。

Source note:
- URL: https://huggingface.co/learn/llm-course/chapter1/5
- The accessible fetched content was substantive but truncated by extraction limits, so this KB entry is explicitly marked partial.