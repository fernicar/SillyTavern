import { isWebLlmSupported } from './extensions/shared.js';

/**
 * Get the WebLLM engine.
 * @returns {Promise<any>} The WebLLM engine.
 */
async function getEngine() {
    if (!isWebLlmSupported()) {
        throw new Error('WebLLM is not supported.');
    }
    return SillyTavern.llm.getEngine();
}

/**
 * Get the list of available WebLLM models.
 * @returns {{id:string, toString: function(): string}[]} The list of models.
 */
export function getModels() {
    if (!isWebLlmSupported()) {
        return [];
    }
    return SillyTavern.llm.getChatModels();
}

/**
 * Load a WebLLM model.
 * @param {string} modelId The ID of the model to load.
 * @returns {Promise<void>}
 */
export async function loadModel(modelId) {
    const engine = await getEngine();
    await engine.loadModel(modelId);
}

/**
 * Generate a chat stream from WebLLM.
 * @param {object[]} messages The messages to generate a response from.
 * @param {object} generate_data The generation data.
 * @returns {AsyncGenerator<any, void, any>} The generated chat stream.
 */
export async function* generateChatStream(messages, generate_data) {
    const engine = await getEngine();
    const stream = engine.chat.completions.create({
        stream: true,
        messages: messages,
        ...generate_data,
    });

    let reply = '';
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
            reply += delta;
        }
        yield { text: reply, swipes: [], logprobs: null, toolCalls: [], state: {} };
    }
}
