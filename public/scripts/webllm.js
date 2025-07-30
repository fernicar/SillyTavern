import * as webllm from 'https://esm.run/@mlc-ai/web-llm';

/**
 * @typedef {Object} ModelView Model view model
 * @property {string} id Model ID
 * @property {number} vram_required VRAM required in MB
 * @property {number} context_size Content window size
 */

/**
 * @typedef {Object} CompletionParam Additional parameters for completion
 * @property {number} [max_tokens] Maximum tokens to generate
 * @property {number} [temperature] Sampling temperature
 * @property {number} [top_p] Nucleus sampling probability
 * @property {number} [frequency_penalty] Frequency penalty
 * @property {number} [presence_penalty] Presence penalty
 * @property {string[]} [stop] Stop sequence
 */

class AsyncLock {
    #lock = false;
    #queue = [];

    async acquireLock() {
        if (this.#lock) {
            console.debug('Deferring lock acquisition', this);
            await new Promise(resolve => this.#queue.push(resolve));
        }
        console.debug('Acquiring lock', this);
        this.#lock = true;
    }

    releaseLock() {
        if (this.#queue.length > 0) {
            console.debug('Releasing one lock', this);
            const resolve = this.#queue.shift();
            resolve();
        } else {
            console.debug('Releasing lock', this);
            this.#lock = false;
        }
    }
}

/**
 * Provides a simplified API for generating text.
 */
export class WebLLMEngineWrapper extends EventTarget {
    /**
     * Underlying model engine.
     * @type {webllm.MLCEngine}
     */
    #engine = null;
    /**
     * Current model ID.
     * @type {string}
     */
    #currentModelId = null;
    /**
     * Set to true to suppress progress messages.
     * @type {boolean}
     */
    #silent = false;
    /**
     * Default completion parameters.
     * @type {CompletionParam}
     */
    #defaultCompletionParams = null;
    /**
     * Lock to prevent concurrent requests.
     * @type {AsyncLock}
     */
    #lock = new AsyncLock();
    /**
     * Toast element for progress messages.
     * @type {JQuery}
     */
    #toast = $();

    constructor(modelId = null, silent = false) {
        super();
        this.#currentModelId = modelId;
        this.#silent = silent;

        if (!silent) {
            this.#toast = toastr.info('Please wait...', 'WebLLM', {
                timeOut: 0,
                extendedTimeOut: 0,
                closeButton: true,
                tapToDismiss: false,
                progressBar: false,
            }).hide();
        }
    }

    /**
     * Gets an instance of the engine.
     * @param {string?} modelId Model ID
     * @param {boolean?} silent Set to true to suppress progress messages
     * @returns
     */
    getEngine(modelId = null, silent = false) {
        return new WebLLMEngineWrapper(modelId, silent);
    }

    /**
     * Get a progress bar to show the initialization progress.
     * @returns {(report: webllm.InitProgressReport) => void}
     */
    #getProgressBar() {
        if (this.#silent) {
            return (progress) => {
                if (!isNaN(progress?.progress)) {
                    console.debug(progress);
                }
            };
        }

        return (progress) => {
            if (!isNaN(progress?.progress)) {
                console.debug(progress);
            }
            if (progress?.text) {
                this.#toast.show();
                this.#toast.find('.toast-message').text(progress.text);
            }
            const value = Math.floor(progress?.progress * 100);
            if (isNaN(value)) {
                return this.#toast.hide();
            }
        };
    }

    /**
     * Convert a model object to a model view model.
     * @param {webllm.ModelRecord} model Model object
     * @returns {ModelView} Model view model
     */
    #modelToViewModel(model) {
        if (!model) {
            return null;
        }

        return {
            id: model.model_id,
            vram_required: model.vram_required_MB,
            context_size: model.overrides?.context_window_size,
            toString: () => `${model.model_id} | ${Number(model.vram_required_MB / 1024).toFixed(1)} GB | ${model.overrides?.context_window_size} ctx`,
        };
    }

    /**
     * Initialize the engine with the given model.
     * @param {string} [modelId] Model ID
     * @returns {Promise<void>}
     */
    async #initEngine(modelId = null) {
        const updateProgress = this.#getProgressBar();

        try {
            if (!modelId && this.#currentModelId) {
                modelId = this.#currentModelId;
            }

            if (!modelId) {
                throw new Error('Model ID is required');
            }

            if (!this.#engine) {
                this.#currentModelId = modelId;
                this.#engine = await webllm.CreateMLCEngine(modelId, {
                    initProgressCallback: updateProgress,
                });
            }

            if (this.#currentModelId !== modelId) {
                this.#currentModelId = modelId;
                await this.#engine.reload(modelId);
            }

            updateProgress({ progress: NaN });
            this.dispatchEvent(new CustomEvent('modelReady', { detail: { modelId } }));
        } catch (error) {
            if (!this.#silent) toastr.error(error.message, 'Failed to initialize model');
            console.error(error);
            updateProgress({ progress: NaN });
            throw error;
        }
    }

    /**
     * Get a list of models available in the prebuilt app.
     * @returns {ModelView[]} Array of model view models
     */
    getModels() {
        return webllm
            .prebuiltAppConfig
            .model_list
            .filter(x => x.model_type !==  webllm.ModelType.embedding)
            .map(this.#modelToViewModel)
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * Load the default completion parameters.
     * @param {CompletionParam} params
     */
    setDefaultParams(params) {
        this.#defaultCompletionParams = { ...params };
    }

    /**
     * Get the default completion parameters.
     * @returns {CompletionParam} Default completion parameters
     */
    getDefaultParams() {
        return { ...this.#defaultCompletionParams };
    }

    /**
     * Gets combined completion parameters.
     * @param {CompletionParam} params Override completion parameters
     * @returns {CompletionParam} Combined completion parameters
     */
    #getParams(params) {
        return { ...this.#defaultCompletionParams, ...params };
    }

    /**
     * Get the information for the current model. Null if no model is loaded.
     * @returns {ModelView | null} Model view model
     */
    getCurrentModelInfo() {
        if (!this.#currentModelId) {
            return null;
        }

        return this.#modelToViewModel(webllm.prebuiltAppConfig.model_list.find(model => model.model_id === this.#currentModelId));
    }

    /**
     * Set the current model ID without loading the model.
     * @param {string} modelId Model ID
     */
    setCurrentModelId(modelId) {
        this.#currentModelId = modelId;
    }

    /**
     * Load the specified model.
     * @param {string} [modelId] Model ID
     * @returns {Promise<void>}
     */
    async loadModel(modelId = null) {
        try {
            await this.#lock.acquireLock();
            await this.#initEngine(modelId);
        } catch (error) {
            console.error(error);
            if (!this.#silent) toastr.error(`Failed to load model: ${error.message}`, 'WebLLM');
        } finally {
            this.#lock.releaseLock();
        }
    }

    /**
     * Generates a stream based on the given prompt using the specified model.
     * Compatible with StreamingProcessor interface.
     * @param {webllm.ChatCompletionMessageParam[]} messages Array of messages
     * @param {CompletionParam} [params] Additional parameters for completion
     * @returns {AsyncGenerator<{ text: string, swipes: any[], logprobs: null }>} Async generator that yields the generated
     */
    async* generateChatStream(messages, params = null) {
        try {
            await this.#lock.acquireLock();
            await this.#initEngine();
            /** @type {webllm.ChatCompletionRequestStreaming} */
            const request = {
                ...this.#getParams(params),
                messages,
                stream: true,
            };
            const completion = await this.#generateWithRetry(() => this.#engine.chatCompletion(request));

            let text = '';
            for await (const choice of completion) {
                text += choice?.choices?.[0]?.delta?.content ?? '';
                yield { text: text, swipes: [], logprobs: null };
            }
        } catch (error) {
            console.error(error);
            if (!this.#silent) toastr.error(`Failed to generate: ${error.message}`, 'WebLLM');
        } finally {
            this.#lock.releaseLock();
        }
    }

    /**
     * Executes the given function with retries.
     * @template T
     * @param {() => Promise<T>} func - The function to retry.
     * @param {number} maxRetries - The maximum number of retries.
     * @returns {Promise<T>} The result of the function.
     */
    async #generateWithRetry(func, maxRetries = 1) {
        let i = 0;
        while (i++ < maxRetries) {
            try {
                return await func();
            } catch (error) {
                console.error(error);

                if (maxRetries <= 0) {
                    throw error;
                }

                console.warn('Generation failed. Reloading model, retry #', i);
                await this.#engine.reload(this.#currentModelId);
            }
        }
    }

    /**
     * Count the number of tokens in the given text.
     * @param {string} text Text to count tokens
     * @returns {Promise<number>} Promise that resolves to the number of tokens
     */
    async countTokens(text) {
        try {
            await this.#lock.acquireLock();
            await this.#initEngine();
            const tokenizer = this.#engine?.pipeline?.tokenizer;
            if (tokenizer) {
                const tokens = Array.from(tokenizer.encode(text));
                return tokens.length;
            }
        } catch (error) {
            console.error(error);
            if (!this.#silent) toastr.error(`Failed to count tokens: ${error.message}`, 'WebLLM');
        } finally {
            this.#lock.releaseLock();
        }

        throw new Error('[WebLLM] Model provides no tokenizer');
    }
}
