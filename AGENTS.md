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

**Implementation Checklist:**

- [x] Add `WEBLLM` to `CHAT_COMPLETION_SOURCES` in `src/constants.js`.
- [x] Add `webllm_model` to `settingsToUpdate` in `public/scripts/openai.js`.
- [x] Add `webllm_model` to `default_settings` in `public/scripts/openai.js`.
- [x] Add `webllm_model` to `oai_settings` in `public/scripts/openai.js`.
- [x] Add `webllm` case to `getChatCompletionModel` in `public/scripts/openai.js`.
- [x] Add `populateWebLLMModels` function to `public/scripts/openai.js`.
- [x] Add call to `populateWebLLMModels` in `toggleChatCompletionForms` in `public/scripts/openai.js`.
- [x] Add `webllm` case to `/status` endpoint in `src/endpoints/backends/chat-completions.js`.
- [x] Add import for `getWebLLMModels` in `public/scripts/openai.js`.
- [x] Correct quote in error message in `public/scripts/openai.js`.
- [x] Add `webllm` case to `/generate` endpoint in `src/endpoints/backends/chat-completions.js`.

**Notes on `generateChatPrompt` and `generateChatStream`:**

*   **`generateChatPrompt`**: This function is designed for non-streaming responses. It takes an array of messages and returns a single string with the complete response. It's an `async` function that internally handles locking to prevent concurrent requests.
*   **`generateChatStream`**: This function is for streaming responses. It's an `async` generator function that yields partial responses as they are generated. It also handles locking. The yielded objects have the shape `{ text: string, swipes: any[], logprobs: null }`.

**Plan to fix the streaming and response generation:**

1.  **Modify `public/scripts/openai.js`:**
    *   In the `sendOpenAIRequest` function, when the `chat_completion_source` is `webllm`, call `generateChatStream` instead of `generateChatPrompt`.
    *   The `sendOpenAIRequest` function should return an `async` generator that yields the responses from `generateChatStream` in the correct format.

**Further Research on `WebLLMEngineWrapper`:**

*   **`getModels()` vs `getChatModels()`**: The `WebLLMEngineWrapper` class in the extension has a `getModels()` method, not `getChatModels()`. I need to correct this in my `public/scripts/webllm.js` implementation.
*   **`isWebLlmSupported()`**: This function checks for the existence of `SillyTavern.llm`. If it exists, it means the WebLLM extension is active. My implementation should use this to decide whether to use the extension's engine or create a new one.
*   **`WebLLMEngineWrapper` Import**: I need to import the `WebLLMEngineWrapper` class into `public/scripts/webllm.js` so I can instantiate it when the extension is not present.

**Revised Plan:**

1.  **Modify `public/scripts/webllm.js`:**
    *   Import the `WebLLMEngineWrapper` class from `../../data/default-user/extensions/Extension-WebLLM/src/index.js`.
    *   In the `getEngine` function, check if `isWebLlmSupported()` is true.
        *   If true, return `SillyTavern.llm.getEngine()`.
        *   If false, create a new instance of `WebLLMEngineWrapper` and return it.
    *   In the `getModels` function, check if `isWebLlmSupported()` is true.
        *   If true, return `SillyTavern.llm.getModels()`.
        *   If false, call the `getModels()` method of the locally created `WebLLMEngineWrapper` instance.
2.  **Modify `public/scripts/openai.js`:**
    *   Ensure that the `getWebLLMModels` function is correctly imported and used.

keep this document updated each time you commit.
