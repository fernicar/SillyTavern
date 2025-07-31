Research how does the Extesion WebLLM works from path
data\default-user\extensions\Extension-WebLLM
things imporant to note are:
The extension allows the root project to use code dedicate to WebLLM and disables it if this extension isnt installed otherwise.
There is a fetch function to learn how does it manage the model name and memory.
There is a 'Try it out!' button to learn how does the chat works

The WebLLM extension registers itself as a chat completion source using `SillyTavern.extra_chat_completion_sources`. The main logic is in `src/index.js`, which creates a `WebLLMEngineWrapper` instance. This class handles loading the WebLLM engine, managing models, and generating chat responses. The `manifest.json` file defines the extension's metadata and entry point. The models are defined in the `WebLLMEngineWrapper` constructor, with their RAM requirements and a `toString()` method for display. The "Try it out!" button triggers a test generation to ensure the model is working.


The WebLLM is a great feature that would be great to implement as an option to select instead of the other providers like OpenAI, Anthropic, etc
before that research:
how does the SillyTavern works to choose the provider and load its model list, 
how does the 'Connect' button enables the Send button on the chat, 
how does the no-api key would work if implementing 'WebLLM (local)' as provider.

Providers are managed in `public/scripts/openai.js`. The `chat_completion_sources` object lists the available providers. The `toggleChatCompletionForms` function shows/hides the settings for the selected provider. The `onModelChange` function handles changes to the model selection dropdown. The `getStatusOpen` function is called when the "Connect" button is clicked. It validates the connection and fetches the model list. For a local provider like WebLLM, no API key is needed. The "Connect" button can be used to initialize the engine and populate the model list. The "Connect" button enables the send button by setting the online status to "Valid".

**Additional Research on WebLLM Integration:**

*   **`public/scripts/extensions/shared.js`**: Contains shared utility functions for extensions, including `isWebLlmSupported`, `generateWebLlmChatPrompt`, `countWebLlmTokens`, and `getWebLlmContextSize`. These functions interact with the WebLLM extension via a global `SillyTavern.llm` object.
*   **`public/scripts/extensions/vectors/webllm.js`**: Defines the `WebLlmVectorProvider` class, which encapsulates the logic for interacting with the WebLLM engine for vector embeddings. This is a good pattern to follow for isolating WebLLM logic.
*   **`src/endpoints/vectors.js`**: The backend endpoint for vector operations shows that for WebLLM, the client is responsible for generating embeddings and sending them to the server.
*   **Key Insight**: Existing extensions that use WebLLM rely on a global `SillyTavern.llm` object provided by the WebLLM extension. My current implementation creates a new `WebLLMEngineWrapper` instance, which is a different approach and likely the cause of the problems. I should align my implementation to use the shared `SillyTavern.llm` object when it's available.

**Notes on my `public/scripts/webllm.js` implementation:**

*   **Purpose**: To provide a self-contained WebLLM provider for chat completions.
*   **Current Approach**: It creates its own `WebLLMEngineWrapper` instance and manages the WebLLM engine independently of the WebLLM extension.
*   **Alternatives**: A better approach would be to check for the existence of the `SillyTavern.llm` object. If it exists, use it. If not, then fall back to creating a new engine instance. This would make the native provider compatible with the WebLLM extension and avoid conflicts.
*   **Warnings**: The current approach can lead to multiple WebLLM instances running, which can cause performance issues and unexpected behavior. It also doesn't leverage the existing WebLLM extension's capabilities, such as its model management.

keep this document updated each time you commit.
