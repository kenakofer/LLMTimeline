import json, urllib.request, urllib.parse, concurrent.futures as cf
from pathlib import Path
HERE = Path(__file__).resolve().parent
CACHE = HERE / 'cache'
G = {
 'gpt-2':'openai-community/gpt2-xl','gpt-oss-120b':'openai/gpt-oss-120b','gpt-oss-20b':'openai/gpt-oss-20b',
 'bert':'google-bert/bert-large-uncased','t5':'google-t5/t5-11b','flan-t5':'google/flan-t5-xxl','switch-transformer':'google/switch-c-2048',
 'gemma':'google/gemma-7b','gemma-2':'google/gemma-2-27b','gemma-3':'google/gemma-3-27b-it','gemma-4':'google/gemma-4-31b-it',
 'roberta':'FacebookAI/roberta-large','galactica':'facebook/galactica-120b',
 'llama-2':'meta-llama/Llama-2-70b-hf','code-llama':'meta-llama/CodeLlama-34b-hf','llama-3':'meta-llama/Meta-Llama-3-70B',
 'llama-3-1-405b':'meta-llama/Llama-3.1-405B','llama-3-1-70b':'meta-llama/Llama-3.1-70B','llama-3-1-8b':'meta-llama/Llama-3.1-8B',
 'llama-3-3-70b':'meta-llama/Llama-3.3-70B-Instruct','llama-4-scout':'meta-llama/Llama-4-Scout-17B-16E','llama-4-maverick':'meta-llama/Llama-4-Maverick-17B-128E',
 'deepseek-coder':'deepseek-ai/deepseek-coder-33b-base','deepseek-llm':'deepseek-ai/deepseek-llm-67b-base','deepseek-v2':'deepseek-ai/DeepSeek-V2',
 'deepseek-coder-v2':'deepseek-ai/DeepSeek-Coder-V2-Instruct','deepseek-v2-5':'deepseek-ai/DeepSeek-V2.5','deepseek-v3':'deepseek-ai/DeepSeek-V3',
 'deepseek-r1-zero':'deepseek-ai/DeepSeek-R1-Zero','deepseek-r1':'deepseek-ai/DeepSeek-R1','deepseek-r1-distill-qwen-32b':'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
 'deepseek-r1-distill-llama-70b':'deepseek-ai/DeepSeek-R1-Distill-Llama-70B','deepseek-v3-1':'deepseek-ai/DeepSeek-V3.1','deepseek-v3-2-exp':'deepseek-ai/DeepSeek-V3.2-Exp',
 'deepseek-v3-2':'deepseek-ai/DeepSeek-V3.2','deepseek-v4':'deepseek-ai/DeepSeek-V4-Pro','deepseek-v4-flash':'deepseek-ai/DeepSeek-V4-Flash','deepseek-v4-1-flash':'deepseek-ai/DeepSeek-V4.1-Flash',
 'mistral-7b':'mistralai/Mistral-7B-v0.1','mixtral-8x7b':'mistralai/Mixtral-8x7B-v0.1','mixtral-8x22b':'mistralai/Mixtral-8x22B-v0.1','mistral-nemo':'mistralai/Mistral-Nemo-Base-2407',
 'mistral-large-2':'mistralai/Mistral-Large-Instruct-2407','mistral-small-3':'mistralai/Mistral-Small-24B-Base-2501','magistral-small':'mistralai/Magistral-Small-2506',
 'mistral-medium-3-5':'mistralai/Mistral-Medium-3.5-128B','grok-1':'xai-org/grok-1',
 'qwen':'Qwen/Qwen-14B','qwen1-5':'Qwen/Qwen1.5-72B','qwen2':'Qwen/Qwen2-72B','qwen2-5-72b':'Qwen/Qwen2.5-72B','qwen2-5-32b':'Qwen/Qwen2.5-32B',
 'qwen2-5-coder-32b':'Qwen/Qwen2.5-Coder-32B','qwq-32b':'Qwen/QwQ-32B','qwen3-235b-a22b':'Qwen/Qwen3-235B-A22B','qwen3-coder':'Qwen/Qwen3-Coder-480B-A35B-Instruct',
 'qwen3-5':'Qwen/Qwen3.5-397B-A17B','qwen3-8-2-4t':'Qwen/Qwen3.8-2.4T-A95B',
 'kimi-k2':'moonshotai/Kimi-K2-Instruct','kimi-k2-thinking':'moonshotai/Kimi-K2-Thinking','kimi-k2-5':'moonshotai/Kimi-K2.5','kimi-k2-6':'moonshotai/Kimi-K2.6','kimi-k3':'moonshotai/Kimi-K3',
 'glm-130b':'zai-org/glm-130b','glm-4-5':'zai-org/GLM-4.5','glm-4-6':'zai-org/GLM-4.6','glm-4-7':'zai-org/GLM-4.7','glm-5':'zai-org/GLM-5','glm-5-1':'zai-org/GLM-5.1','glm-5-2':'zai-org/GLM-5.2',
 'minimax-text-01':'MiniMaxAI/MiniMax-Text-01','minimax-m1':'MiniMaxAI/MiniMax-M1-80k','minimax-m2':'MiniMaxAI/MiniMax-M2','minimax-m2-1':'MiniMaxAI/MiniMax-M2.1',
 'minimax-m2-5':'MiniMaxAI/MiniMax-M2.5','minimax-m2-7':'MiniMaxAI/MiniMax-M2.7','minimax-m3':'MiniMaxAI/MiniMax-M3',
 'gpt-j':'EleutherAI/gpt-j-6b','gpt-neox-20b':'EleutherAI/gpt-neox-20b','bloom':'bigscience/bloom','falcon-180b':'tiiuae/falcon-180B','yi-34b':'01-ai/Yi-34B',
 'command-r-plus':'CohereLabs/c4ai-command-r-plus','nemotron-4-340b':'nvidia/Nemotron-4-340B-Base','llama-3-1-nemotron-70b':'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
 'phi-4':'microsoft/phi-4','olmo-2':'allenai/OLMo-2-0325-32B',
}
def api(path):
    req=urllib.request.Request('https://huggingface.co/api/'+path,headers={'User-Agent':'LLMTimeline-curator'})
    return json.load(urllib.request.urlopen(req,timeout=30))
def look(item):
    nid,repo=item
    try:
        j=api('models/'+repo)
        cd=j.get('cardData') or {}
        return nid,repo,j.get('id'),cd.get('base_model'),cd.get('license'),j.get('createdAt','')[:10],None
    except Exception as e:
        return nid,repo,None,None,None,None,str(e)[:40]
if __name__=='__main__':
    out={}
    with cf.ThreadPoolExecutor(12) as ex:
        for nid,repo,real,base,lic,created,err in ex.map(look,G.items()):
            out[nid]=dict(repo=real,base=base,licence=lic,created=created,err=err)
            print(f"{nid:30} {real or ('MISSING '+repo):45} base={base} lic={lic} {created} {err or ''}")
    json.dump(out,open(HERE / 'hf.json','w'),indent=1)
