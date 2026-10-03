# Hand-entered lifecycle facts, each traced to an official page read on 2026-10-01.
# E(type, date, precision, confidence, source, basis=None, bounds=None)

OAI = 'https://developers.openai.com/api/docs/deprecations'
ANT = 'https://platform.claude.com/docs/en/about-claude/model-deprecations'
GDEP = 'https://ai.google.dev/gemini-api/docs/deprecations'
GLOG = 'https://ai.google.dev/gemini-api/docs/changelog'
XAI = 'https://docs.x.ai/developers/release-notes'
DSU = 'https://api-docs.deepseek.com/updates/'
MIS = 'https://docs.mistral.ai/models'

def E(type, date, precision='day', confidence='confirmed', source=None, basis=None, bounds=None):
    e = dict(type=type, date=date, precision=precision, confidence=confidence)
    if basis: e['basis'] = basis
    if bounds: e['bounds'] = bounds
    if source: e['source'] = source
    return e

def dep_ret(dep, ret, src, basis=None, ret_conf='confirmed'):
    out = []
    if dep: out.append(E('deprecated', dep, source=src, basis=basis))
    if ret: out.append(E('retired', ret, confidence=ret_conf, source=src, basis=basis))
    return out

F51 = ('Anthropic\'s page is dated only "September 2026". Epoch AI gives 1 September 2026, and the deprecations '
       'table commits to no retirement before 1 September 2027; Anthropic\'s commitments run one year from release '
       '(e.g. Opus 5.5: released 22 September 2026, not before 22 September 2027).')

GOOGLE_EARLIEST = ("Google's deprecations table states that listed shutdown dates are the "
                   "\"earliest possible\" shutdown dates; the date has passed but the page does not "
                   "say outright that the model was shut down on it.")

# Events that replace the generated ones of the same type.
LIFE = {
  # ── OpenAI ──
  'gpt-3': dep_ret('2023-07-06', '2024-01-04', OAI, 'The original davinci base model was deprecated 6 July 2023 and shut down 4 January 2024.'),
  'instructgpt': dep_ret('2023-07-06', '2024-01-04', OAI, 'text-davinci-001, the API name of the InstructGPT model, was shut down 4 January 2024.'),
  'text-davinci-002': dep_ret('2023-07-06', '2024-01-04', OAI),
  'text-davinci-003': [E('available', '2022-11-28', confidence='likely', source=OAI,
                          basis='Served in the OpenAI API until its 4 January 2024 shutdown; availability from the release date given by Epoch AI.')]
                       + dep_ret('2023-07-06', '2024-01-04', OAI),
  'codex': [E('retired', '2023-03-23', source=OAI, basis='code-davinci-002 and the other Codex models were shut down 23 March 2023, three days after the deprecation notice.'),
            E('deprecated', '2023-03-20', source=OAI)],
  'chatgpt': [E('announced', '2022-11-30', source='https://openai.com/blog/chatgpt/'),
              E('available', '2022-11-30', source='https://openai.com/blog/chatgpt/', basis='Launched as a free research preview the day it was announced.')],
  'gpt-3-5-turbo': [E('announced', '2023-03-01', source='https://openai.com/blog/introducing-chatgpt-and-whisper-apis'),
                    E('available', '2023-03-01', source='https://openai.com/blog/introducing-chatgpt-and-whisper-apis', basis='"ChatGPT and Whisper models are now available on our API".')]
                   + dep_ret('2026-04-22', '2026-10-23', OAI, 'gpt-3.5-turbo-0125, the last remaining snapshot, shuts down 23 October 2026.'),
  'gpt-4': [E('announced', '2023-03-14', confidence='likely', source='https://openai.com/index/gpt-4-research/',
              basis="OpenAI's GPT-4 announcement is dated 14 March 2023 but blocks automated fetching; Epoch AI's 15 March is the arXiv submission of the technical report."),
            E('available', '2023-03-14', confidence='likely', source='https://openai.com/index/gpt-4-research/',
              basis='Released in ChatGPT Plus on the announcement day, with API access through a waitlist.')]
           + dep_ret('2026-04-22', '2026-10-23', OAI, 'gpt-4-0613, the last remaining snapshot, shuts down 23 October 2026.'),
  'gpt-4-turbo': dep_ret('2026-04-22', '2026-10-23', OAI, 'gpt-4-turbo-2024-04-09 shuts down 23 October 2026; the preview snapshots were shut down 26 March 2026.'),
  'o1-preview': dep_ret('2025-04-28', '2025-07-28', OAI),
  'o1-mini': dep_ret('2025-04-28', '2025-10-27', OAI),
  'o1': dep_ret('2026-04-22', '2026-10-23', OAI),
  'o3-mini': dep_ret('2026-04-22', '2026-10-23', OAI),
  'o4-mini': dep_ret('2026-04-22', '2026-10-23', OAI),
  'gpt-4-5': dep_ret('2025-04-14', '2025-07-14', OAI, 'Offered in the API only as gpt-4.5-preview.'),
  'gpt-4-1-nano': dep_ret('2026-04-22', '2026-10-23', OAI),
  'o3': [E('available', '2025-04-16', source='https://openai.com/index/introducing-o3-and-o4-mini/',
           basis='Previewed on 20 December 2024 without public access; released 16 April 2025 (date checked on an archived copy of the release post).')]
        + dep_ret('2026-06-11', '2026-12-11', OAI),
  'gpt-5': dep_ret('2026-06-11', '2026-12-11', OAI),
  'gpt-5-mini': dep_ret('2026-06-11', '2026-12-11', OAI),
  'gpt-5-nano': dep_ret('2026-06-11', '2026-12-11', OAI),
  'gpt-5-codex': dep_ret('2026-04-22', '2026-07-23', OAI),
  'gpt-5-2': [E('announced', '2025-12-11', source='https://openai.com/index/introducing-gpt-5-2/'),
              E('available', '2025-12-11', source='https://openai.com/index/introducing-gpt-5-2/', basis='"In the API, they are available now to all developers."')],
  # ── Anthropic ──
  'claude-1': dep_ret('2024-09-04', '2024-11-06', ANT),
  'claude-instant': dep_ret('2024-09-04', '2024-11-06', ANT),
  'claude-2': dep_ret('2025-01-21', '2025-07-21', ANT),
  'claude-2-1': dep_ret('2025-01-21', '2025-07-21', ANT),
  'claude-3-sonnet': dep_ret('2025-01-21', '2025-07-21', ANT),
  'claude-3-opus': dep_ret('2025-06-30', '2026-01-05', ANT),
  'claude-3-haiku': [E('available', '2024-03-13', source='https://www.anthropic.com/news/claude-3-haiku', basis='Announced with the Claude 3 family on 4 March 2024; released 13 March: "Starting today, customers can use Claude 3 Haiku through our API".')]
                    + dep_ret('2026-02-19', '2026-04-20', ANT),
  'claude-3-5-sonnet-20240620': dep_ret('2025-08-13', '2025-10-28', ANT),
  'claude-3-5-sonnet-20241022': [E('announced', '2024-10-22', source='https://www.anthropic.com/news/3-5-models-and-computer-use'),
                                 E('available', '2024-10-22', confidence='likely', source='https://www.anthropic.com/news/3-5-models-and-computer-use', basis='Released as an upgrade to the existing claude-3-5-sonnet model on the announcement day.')]
                                + dep_ret('2025-08-13', '2025-10-28', ANT),
  'claude-3-5-haiku': [E('available', '2024-11-04', source='https://x.com/AnthropicAI/status/1853498267612438873', basis='Announced 22 October 2024 for release "later this month"; Anthropic posted "Claude 3.5 Haiku is now available on our API" on 4 November 2024.')]
                      + dep_ret('2025-12-19', '2026-02-19', ANT),
  'claude-3-7-sonnet': dep_ret('2025-10-28', '2026-02-19', ANT),
  'claude-opus-4': dep_ret('2026-04-14', '2026-06-15', ANT),
  'claude-sonnet-4': dep_ret('2026-04-14', '2026-06-15', ANT),
  'claude-opus-4-1': dep_ret('2026-06-05', '2026-08-05', ANT),
  'claude-sonnet-4-5': dep_ret('2026-09-30', '2026-11-30', ANT),
  'claude-mythos-preview': [
      E('internal', '2026-03-02', precision='month', confidence='estimated',
        source='https://metr.org/blog/2026-05-19-frontier-risk-report/',
        basis='METR\'s frontier risk report says all participating labs "stated that the model(s) they shared represented their internal state-of-the-art at some point in the mid-February to mid-March 2026 assessment window" (16 Feb – 16 Mar 2026), and assesses Claude Mythos Preview. Midpoint of the window taken; METR relies on company attestation.',
        bounds={'earliest': '2026-02-16', 'latest': '2026-03-16'}),
      E('limited', '2026-03-17', precision='month', confidence='estimated',
        source='https://www.anthropic.com/glasswing',
        basis='Partner statements on the 7 April announcement page, e.g. Palo Alto Networks: "Over the past few weeks, we\'ve had access to the Claude Mythos Preview model". About three weeks before the announcement assumed.',
        bounds={'latest': '2026-04-07'}),
      E('deprecated', '2026-06-09', source=ANT, basis='Deprecated when Claude Mythos 5 launched; retirement date "To be announced".')],
  'claude-mythos-5': [E('limited', '2026-06-09', source='https://www.anthropic.com/news/claude-fable-5-mythos-5', basis='Launched for "a small group of cyberdefenders and infrastructure providers" through Project Glasswing; not generally available.')],
  'claude-fable-5-1': [E('announced', '2026-09-01', confidence='likely', source='https://www.anthropic.com/claude-fable-and-mythos-5-1', basis=F51),
                       E('available', '2026-09-01', confidence='likely', source='https://www.anthropic.com/claude-fable-and-mythos-5-1',
                         basis='"Claude Fable 5.1 is available today on all platforms"; dated as the announcement.')],
  'claude-mythos-5-1': [E('announced', '2026-09-01', confidence='likely', source='https://www.anthropic.com/claude-fable-and-mythos-5-1', basis=F51),
                        E('limited', '2026-09-01', confidence='likely', source='https://www.anthropic.com/claude-fable-and-mythos-5-1',
                          basis='"Mythos 5.1 is available only through our trusted access programs"; dated as the announcement.')],
  # ── Google ──
  'gemini-1-0-ultra': [E('available', '2024-02-08', source='https://blog.google/products/gemini/bard-gemini-advanced-app/',
                         basis='Bard was renamed Gemini and Ultra 1.0 became available in the paid Gemini Advanced tier.')],
  'gemini-1-5-pro': [E('limited', '2024-02-15', confidence='likely', source='https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/',
                       basis='Announced as a limited preview for developers and enterprise customers in AI Studio and Vertex AI.'),
                     E('available', '2024-04-09', source='https://developers.googleblog.com/2024/04/gemini-15-pro-in-public-preview-with-new-features.html',
                       basis='Public preview in the Gemini API in 180+ countries.')],
  'gemini-2-0-flash': [E('available', '2025-02-05', source=GDEP), E('retired', '2026-06-01', confidence='likely', source=GDEP, basis=GOOGLE_EARLIEST)],
  'gemini-2-0-flash-lite': [E('available', '2025-02-25', source=GDEP), E('retired', '2026-06-01', confidence='likely', source=GDEP, basis=GOOGLE_EARLIEST)],
  'gemini-2-5-pro': [E('limited', '2025-03-25', source=GLOG, basis='gemini-2.5-pro-exp-03-25 released as a public experimental model on 25 March 2025 (changelog); a billed preview followed on 4 April. The deprecations table gives "March 3, 2025" for the 03-25 preview, which contradicts the changelog.'),
                     E('available', '2025-06-17', source=GDEP, basis='Stable gemini-2.5-pro release date.')],
  'gemini-2-5-flash': [E('available', '2025-06-17', source=GDEP)],
  'gemini-2-5-flash-lite': [E('available', '2025-07-22', source=GDEP)],
  'gemini-3-pro': [E('available', '2025-11-18', source=GDEP, basis='Released only as gemini-3-pro-preview, a public preview.'),
                   E('retired', '2026-03-09', confidence='likely', source=GDEP, basis='Preview replaced by gemini-3.1-pro-preview. ' + GOOGLE_EARLIEST)],
  'gemini-3-flash': [E('available', '2025-12-17', source=GDEP, basis='Released as gemini-3-flash-preview.')],
  'gemini-3-1-pro': [E('available', '2026-02-19', source=GDEP, basis='Released as gemini-3.1-pro-preview.')],
  'gemini-3-1-flash-lite': [E('limited', '2026-03-03', source=GDEP, basis='Preview gemini-3.1-flash-lite-preview released 3 March 2026.'),
                            E('available', '2026-05-07', source=GDEP, basis='Stable gemini-3.1-flash-lite release.')],
  'gemini-3-5-flash': [E('available', '2026-05-19', source=GDEP)],
  'gemini-3-5-flash-lite': [E('available', '2026-07-21', source=GDEP)],
  'gemini-3-6-flash': [E('available', '2026-07-21', source=GDEP)],
  'gemini-3-7-flash': [E('available', '2026-08-13', source=GDEP)],
  'gemini-3-8-flash': [E('available', '2026-09-02', source=GDEP)],
  'gemini-3-5-pro': [E('announced', '2026-05-19', confidence='likely', source='https://www.eesel.ai/blog/gemini-3-5-pro',
                       basis='Announced with the Gemini 3.5 series at Google I/O on 19 May 2026 (secondary reporting). Not listed on the Gemini API deprecations table, which lists every released Gemini 3.x model, as of 1 October 2026.')],
  # ── xAI ──
  'grok-1': [E('available', '2024-03-17', source='https://x.ai/news/grok-os', basis='Weights released under Apache 2.0 ("Open Release of Grok-1").')],
  'grok-3': [E('available', '2025-04-03', source=XAI, basis='"Grok 3 models launch on API" — first API availability; consumer access in the Grok app began earlier.')],
  'grok-4': [E('available', '2025-07-09', source=XAI, basis='"You can now use Grok 4 via our API or on grok.com."')],
  'grok-4-20': [E('available', '2026-03-10', source=XAI, basis='"Grok 4.20 and Grok 4.20 Multi-agent are live" on the API.')],
  'grok-4-5': [E('available', '2026-07-08', source=XAI)],
  'grok-4-6': [E('available', '2026-08-12', source=XAI)],
  'grok-4-7': [E('available', '2026-09-21', source=XAI)],
  # ── DeepSeek ──
  'deepseek-v2-5': [E('announced', '2024-09-05', source=DSU, basis='DeepSeek changelog: deepseek-chat and deepseek-coder upgraded to V2.5 on 5 September 2024 (Epoch AI gives 6 September).'),
                    E('available', '2024-09-05', source=DSU)],
  'deepseek-v3': [E('announced', '2024-12-26', source=DSU, basis="DeepSeek changelog entry for the V3 release; Epoch AI's 24 December predates the release, and the arXiv report followed on 27 December."),
                  E('available', '2024-12-26', source=DSU)],
  'deepseek-r1': [E('available', '2025-01-20', source=DSU)],
  'deepseek-v3-1': [E('available', '2025-08-21', source=DSU)],
  'deepseek-v3-2-exp': [E('available', '2025-09-29', source=DSU)],
  'deepseek-v3-2': [E('announced', '2025-12-01', source=DSU), E('available', '2025-12-01', source=DSU)],
  'deepseek-v4': [E('available', '2026-04-24', source=DSU)],
  'deepseek-v4-flash': [E('available', '2026-04-24', source=DSU)],
  'deepseek-v4-1-flash': [E('announced', '2026-09-10', source=DSU), E('available', '2026-09-10', source=DSU)],
  # ── Mistral (closed-weight models only; open-weight API shutdowns go in notes) ──
  'mistral-medium': dep_ret('2024-11-30', '2025-06-16', MIS, 'API model mistral-medium-2312.'),
  'mistral-large': dep_ret('2024-11-30', '2025-06-16', MIS, 'API model mistral-large-2402.'),
  'mistral-medium-3': dep_ret('2026-05-22', '2026-08-31', MIS, 'Both mistral-medium-2505 and its 3.1 update (mistral-medium-2508) retire 31 August 2026.'),
  'magistral-medium': dep_ret('2026-05-22', '2026-07-31', MIS, 'The last version, Magistral Medium 1.2 (magistral-medium-2509), retired 31 July 2026; 1.0 and 1.1 retired 30 November 2025.'),
}

# Curated tags. `expected`: announced, not yet available, and credibly expected to ship soon;
# the model's notes must say why.
TAGS = {
  'gemini-3-5-pro': ['expected'],
}

NOTES = {
  'chatgpt': 'OpenAI: "ChatGPT is fine-tuned from a model in the GPT-3.5 series, which finished training in early 2022."',
  'gpt-4o': 'The original gpt-4o-2024-05-13 snapshot shuts down 23 October 2026 and the chatgpt-4o-latest alias was removed 17 February 2026, but later gpt-4o snapshots had no announced shutdown as of 1 October 2026.',
  'gpt-5-2': 'The gpt-5.2-chat-latest alias was removed 10 August 2026; gpt-5.2 itself had no announced shutdown as of 1 October 2026.',
  'o1': "First of OpenAI's reasoning models to reach general availability.",
  'claude-3-5-sonnet-20241022': 'Released as an upgrade under the same "Claude 3.5 Sonnet" name; widely called "Claude 3.5 Sonnet (new)".',
  'claude-3-7-sonnet': 'First Claude model with extended thinking.',
  'claude-opus-4-6': 'First Claude model listed with an undated model ID (claude-opus-4-6) on the deprecations page.',
  'claude-opus-4-7': 'From Opus 4.7 onward, setting temperature, top_p or top_k to a non-default value returns an error.',
  'claude-mythos-preview': 'Offered only to partner organisations through Project Glasswing for defensive cybersecurity work. Deprecated when Claude Mythos 5 launched.',
  'claude-fable-5': 'Anthropic calls it "a Mythos-class model that we\'ve made safe for general use". When classifiers flag cybersecurity, biology/chemistry or distillation requests, "the response is automatically handled by Claude Opus 4.8 instead."',
  'claude-mythos-5': '"The same underlying model as Fable 5, but with the safeguards lifted in some areas"; restricted to Project Glasswing partners.',
  'claude-mythos-5-1': '"Claude Fable 5.1 and Claude Mythos 5.1 are the same model, but with different levels of safeguards." Available only through trusted access programs.',
  'gemini-2-5-pro': 'Three dated preview snapshots (03-25, 05-06, 06-05) preceded the stable release; they are folded into this entry.',
  'gemini-3-5-pro': 'Announced with the Gemini 3.5 series at Google I/O on 19 May 2026, with release promised for June 2026. Reported targets in June and July slipped, and it was not on the Gemini API as of 1 October 2026; still expected, since Google has shipped the rest of the 3.5 series.',
  'llama-4-behemoth': 'Previewed at the Llama 4 launch as still in training; not released.',
  'deepseek-r1': 'Open-weight reasoning model whose release prompted widespread reassessment of the cost of frontier-level reasoning capability.',
  'deepseek-v4': 'The Pro variant of the V4 release; V4 Flash is listed separately.',
  'grok-1': 'Weights and architecture released under Apache 2.0 on 17 March 2024.',
  'mistral-7b': 'API access (open-mistral-7b) retired 30 March 2025; the weights remain available.',
  'mixtral-8x7b': 'API access (open-mixtral-8x7b) retired 30 March 2025; the weights remain available.',
  'mixtral-8x22b': 'API access (open-mixtral-8x22b) retired 30 March 2025; the weights remain available.',
  'mistral-large-2': 'API access (mistral-large-2407) retired 30 March 2025, and the November 2024 update (mistral-large-2411) retired 31 May 2026; the weights remain available.',
  'mistral-nemo': 'API access (open-mistral-nemo-2407) retired 31 July 2026; the weights remain available.',
  'mistral-small-3': 'API access (mistral-small-2501) retired 30 November 2025; the weights remain available.',
  'mistral-small-3-1': 'API access (mistral-small-2503) retired 30 November 2025; the weights remain available.',
  'gemini-1-5-pro': 'Announced as a limited preview in February 2024; the ECI score is for the May 2024 release.',
}

# Lineage. (from, to, type, confidence, source, basis)
HF = 'https://huggingface.co/'
EDGES = [
  ('deepseek-v3', 'deepseek-r1-zero', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-R1', 'Model card: "DeepSeek-R1-Zero & DeepSeek-R1 are trained based on DeepSeek-V3-Base."'),
  ('deepseek-v3', 'deepseek-r1', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-R1', 'Model card: "DeepSeek-R1-Zero & DeepSeek-R1 are trained based on DeepSeek-V3-Base."'),
  ('deepseek-v3', 'deepseek-v3-1', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-V3.1', 'Model card: V3.1 "is post-trained on the top of DeepSeek-V3.1-Base, which is built upon the original V3 base checkpoint".'),
  ('deepseek-v3-1', 'deepseek-v3-2-exp', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-V3.2-Exp', 'Model card: "V3.2-Exp builds upon V3.1-Terminus", an update of V3.1.'),
  ('deepseek-v3-2-exp', 'deepseek-v3-2', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-V3.2', 'Model card base_model: deepseek-ai/DeepSeek-V3.2-Exp-Base.'),
  ('deepseek-r1', 'deepseek-r1-distill-qwen-32b', 'distill', 'confirmed', HF+'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', '"Using the reasoning data generated by DeepSeek-R1, we fine-tuned several dense models".'),
  ('qwen2-5-32b', 'deepseek-r1-distill-qwen-32b', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', 'Model card lists Qwen2.5-32B as the base model.'),
  ('deepseek-r1', 'deepseek-r1-distill-llama-70b', 'distill', 'confirmed', HF+'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', '"Using the reasoning data generated by DeepSeek-R1, we fine-tuned several dense models".'),
  ('llama-3-3-70b', 'deepseek-r1-distill-llama-70b', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', 'Model card lists Llama-3.3-70B-Instruct as the base model.'),
  ('llama-3-1-70b', 'llama-3-3-70b', 'finetune', 'confirmed', HF+'meta-llama/Llama-3.3-70B-Instruct', 'Model card base_model: meta-llama/Llama-3.1-70B.'),
  ('llama-3-1-70b', 'llama-3-1-nemotron-70b', 'finetune', 'confirmed', HF+'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF', 'Model card base_model: meta-llama/Llama-3.1-70B-Instruct (the instruction-tuned release of the same model).'),
  ('qwen2-5-32b', 'qwq-32b', 'finetune', 'confirmed', HF+'Qwen/QwQ-32B', 'Model card base_model: Qwen/Qwen2.5-32B. (Epoch AI records Qwen2.5-Coder-32B instead; the first-party card is preferred.)'),
  ('qwen2-5-32b', 'qwen2-5-coder-32b', 'finetune', 'confirmed', HF+'Qwen/Qwen2.5-Coder-32B', 'Model card base_model: Qwen/Qwen2.5-32B.'),
  ('mistral-small-3-1', 'magistral-small', 'finetune', 'confirmed', HF+'mistralai/Magistral-Small-2506', 'Model card base_model: mistralai/Mistral-Small-3.1-24B-Instruct-2503.'),
  ('claude-fable-5', 'claude-mythos-5', 'variant', 'confirmed', 'https://www.anthropic.com/news/claude-fable-5-mythos-5', '"It\'s the same underlying model as Fable 5, but with the safeguards lifted in some areas."'),
  ('claude-fable-5-1', 'claude-mythos-5-1', 'variant', 'confirmed', 'https://www.anthropic.com/claude-fable-and-mythos-5-1', '"Claude Fable 5.1 and Claude Mythos 5.1 are the same model, but with different levels of safeguards."'),
  ('gemini-1-5-pro', 'gemini-1-5-flash', 'distill', 'confirmed', 'https://blog.google/innovation-and-ai/products/google-gemini-update-flash-ai-assistant-io-2024/', '"It\'s been trained by 1.5 Pro through a process called \'distillation\'".'),
  ('gemini-2-5-pro', 'gemini-2-5-flash', 'distill', 'likely', 'https://arxiv.org/abs/2507.06261', 'Gemini 2.5 report: "The smaller models in the Gemini 2.5 series — Flash size and below — use distillation, as was done in the Gemini 1.5 series." The teacher is not named; 2.5 Pro is the inferred teacher.'),
  ('llama-4-behemoth', 'llama-4-maverick', 'distill', 'confirmed', 'https://ai.meta.com/blog/llama-4-multimodal-intelligence/', '"We codistilled the Llama 4 Maverick model from Llama 4 Behemoth as a teacher model".'),
  ('llama-3-1-405b', 'llama-3-1-70b', 'distill', 'confirmed', 'https://ai.meta.com/blog/meta-llama-3-1/', '"We also used the 405B parameter model to improve the post-training quality of our smaller models."'),
  ('llama-3-1-405b', 'llama-3-1-8b', 'distill', 'confirmed', 'https://ai.meta.com/blog/meta-llama-3-1/', '"We also used the 405B parameter model to improve the post-training quality of our smaller models."'),
  ('deepseek-v2', 'deepseek-v2-5', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-V2.5', 'Model card: "DeepSeek-V2.5 is an upgraded version that combines DeepSeek-V2-Chat and DeepSeek-Coder-V2-Instruct."'),
  ('deepseek-coder-v2', 'deepseek-v2-5', 'finetune', 'confirmed', HF+'deepseek-ai/DeepSeek-V2.5', 'Model card: "DeepSeek-V2.5 is an upgraded version that combines DeepSeek-V2-Chat and DeepSeek-Coder-V2-Instruct."'),
  ('kimi-k2', 'kimi-k2-5', 'finetune', 'confirmed', HF+'moonshotai/Kimi-K2.5', 'Model card: "built through continual pretraining on approximately 15 trillion mixed visual and text tokens atop Kimi-K2-Base."'),
  ('mistral-small-3', 'mistral-small-3-1', 'finetune', 'likely', 'https://mistral.ai/news/mistral-small-3-1', '"Building on Mistral Small 3, this new model comes with improved text performance, multimodal understanding, and an expanded context window". Weight inheritance is implied, not stated.'),
  ('text-davinci-002', 'chatgpt', 'finetune', 'likely', 'https://openai.com/blog/chatgpt/', 'OpenAI: "ChatGPT is fine-tuned from a model in the GPT-3.5 series, which finished training in early 2022." The exact parent is not named; text-davinci-002 stands in for the GPT-3.5 series.'),
]
# Base models recorded by Epoch AI but not re-verified first-hand: (from, to, epoch_base_name)
EPOCH_EDGES = [
  ('gpt-3', 'instructgpt', 'GPT-3 175B (davinci)'),
  ('gpt-3', 'codex', 'GPT-3 13B'),
  ('gpt-5', 'gpt-5-codex', 'GPT-5'),
  ('claude-2', 'claude-2-1', 'Claude 2'),
  ('t5', 'flan-t5', 'T5-11B'),
  ('palm', 'flan-palm', 'PaLM (540B)'),
  ('llama-2', 'code-llama', 'Llama 2-34B'),
  ('deepseek-v2', 'deepseek-coder-v2', 'DeepSeek-V2 (MoE-236B)'),
  ('mistral-medium-3', 'magistral-medium', 'Mistral Medium 3'),
  ('kimi-k2', 'kimi-k2-thinking', 'Kimi K2'),
  ('kimi-k2-5', 'kimi-k2-6', 'Kimi K2.5'),
  ('glm-4-5', 'glm-4-7', 'GLM-4.5'),
  ('glm-5-2', 'glm-5-3', 'GLM-5.2'),
  ('minimax-text-01', 'minimax-m1', 'MiniMax-Text-01'),
]
