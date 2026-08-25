# SilkLLM SDKs

Python and JavaScript SDKs for the SilkLLM API.

## Python

```bash
pip install -e packages/python
```

```python
import silkllm
client = silkllm.Client(api_key="silk_...")
response = client.generate(messages=[{"role": "user", "content": "Hello!"}])
print(response.content)
```

## JavaScript

```bash
cd packages/javascript && npm install && npm run build
```

```javascript
import SilkLLM from "silkllm";
const client = new SilkLLM({ apiKey: "silk_..." });
const response = await client.generate({ messages: [{ role: "user", content: "Hello!" }] });
console.log(response.content);
```

## Cookbooks

Runnable, production-shaped examples in [`cookbooks/`](./cookbooks): a
multimodal generation pipeline, and provisioning a spend-capped key for an
autonomous agent.
