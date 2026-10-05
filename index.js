(function () {
'use strict';
function _define_property$3(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _object_spread$3(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$3(target, key, source[key]);
        });
    }
    return target;
}
function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var STORE_NAME = 'realtime-translator-en';
var DEFAULT_OUTGOING_LANGUAGE = 'es';
var DISABLED = Object.freeze({
    incoming: false,
    outgoing: false,
    outgoingLanguage: DEFAULT_OUTGOING_LANGUAGE,
    showOwnEnglish: true
});
function normalizeLanguage(value) {
    if (typeof value !== 'string') return DEFAULT_OUTGOING_LANGUAGE;
    var trimmed = value.trim().toLocaleLowerCase();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(trimmed)) return DEFAULT_OUTGOING_LANGUAGE;
    return trimmed;
}
/**
 * Per-channel configuration persisted through Unbound's settings store.
 *
 * Every chat is independent and defaults to fully disabled, so enabling
 * translation in one DM never affects another conversation.
 */ function createChatConfig(store) {
    function readChats() {
        var chats = store.get('chats', {});
        return chats && (typeof chats === "undefined" ? "undefined" : _type_of$3(chats)) === 'object' ? chats : {};
    }
    function patch(channelId, changes) {
        var _chats_channelId;
        if (!channelId) return;
        var chats = readChats();
        var existing = (_chats_channelId = chats[channelId]) !== null && _chats_channelId !== void 0 ? _chats_channelId : {};
        store.set("chats.".concat(channelId), _object_spread$3({}, existing, changes));
    }
    return {
        for: function _for(channelId) {
            if (typeof channelId !== 'string' || !channelId) return DISABLED;
            var entry = readChats()[channelId];
            if (!entry || (typeof entry === "undefined" ? "undefined" : _type_of$3(entry)) !== 'object') return DISABLED;
            return {
                incoming: entry.incoming === true,
                outgoing: entry.outgoing === true,
                outgoingLanguage: normalizeLanguage(entry.outgoingLanguage),
                showOwnEnglish: entry.showOwnEnglish !== false
            };
        },
        setIncoming: function setIncoming(channelId, value) {
            patch(channelId, {
                incoming: value === true
            });
        },
        setOutgoing: function setOutgoing(channelId, value) {
            patch(channelId, {
                outgoing: value === true
            });
        },
        setOutgoingLanguage: function setOutgoingLanguage(channelId, value) {
            patch(channelId, {
                outgoingLanguage: normalizeLanguage(value)
            });
        },
        setShowOwnEnglish: function setShowOwnEnglish(channelId, value) {
            patch(channelId, {
                showOwnEnglish: value === true
            });
        },
        enabledChannels: function enabledChannels() {
            var chats = readChats();
            return Object.keys(chats).filter(function(channelId) {
                var entry = chats[channelId];
                return (entry === null || entry === void 0 ? void 0 : entry.incoming) === true || (entry === null || entry === void 0 ? void 0 : entry.outgoing) === true;
            });
        },
        reset: function reset(channelId) {
            if (!channelId) return;
            store.set("chats.".concat(channelId), {
                incoming: false,
                outgoing: false,
                outgoingLanguage: DEFAULT_OUTGOING_LANGUAGE,
                showOwnEnglish: true
            });
        }
    };
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$5(arr);
}
function asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator$2(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _define_property$2(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$4() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread$2(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$2(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$1(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$1(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$1(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _to_consumable_array$4(arr) {
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_spread$4();
}
function _ts_generator$2(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
var TRANSLATION_MARKER$1 = '\n-# ↳ English: ';
function toPlainMessage(message) {
    if (typeof (message === null || message === void 0 ? void 0 : message.toJS) === 'function') return message.toJS();
    return _object_spread$2({}, message);
}
function channelIdOf(message) {
    var _ref;
    var channelId = (_ref = message === null || message === void 0 ? void 0 : message.channel_id) !== null && _ref !== void 0 ? _ref : message === null || message === void 0 ? void 0 : message.channelId;
    return typeof channelId === 'string' ? channelId : null;
}
function authorIdOf(message) {
    var _ref, _ref1;
    var _message_author;
    var authorId = (_ref = (_ref1 = message === null || message === void 0 ? void 0 : (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.id) !== null && _ref1 !== void 0 ? _ref1 : message === null || message === void 0 ? void 0 : message.author_id) !== null && _ref !== void 0 ? _ref : message === null || message === void 0 ? void 0 : message.authorId;
    return typeof authorId === 'string' ? authorId : null;
}
function escapeTranslation(text) {
    return text.replace(/\s*\r?\n+\s*/g, ' ').trim().replace(/\\/g, '\\\\').replace(/([*_~`|<>\[\]()])/g, '\\$1').replace(/@/g, '@\u200B');
}
function isAbortError(error) {
    return _instanceof(error, Error) && error.name === 'AbortError';
}
function createRealtimeController(dependencies) {
    var historyActionTypes = [
        'LOAD_MESSAGES_SUCCESS',
        'LOCAL_MESSAGES_LOADED',
        'LOAD_MESSAGES_AROUND_SUCCESS'
    ];
    /**
   * Events that replace a message already in the store with a server copy,
   * discarding our local decoration. Each one must trigger re-application.
   */ var reconcileActionTypes = [
        'MESSAGE_SEND_SUCCESS',
        'MESSAGE_UPDATE',
        'MESSAGE_SEND_FAILED'
    ];
    var modified = new Map();
    var pending = new Map();
    var historyQueue = [];
    var active = false;
    var generation = 0;
    var processingHistoryGeneration;
    var reconciling = false;
    function translateMessage(message, workGeneration) {
        return _async_to_generator$2(function() {
            var _dependencies_decorations, _message_author, _dependencies_config, _dependencies_users_getCurrentUser, messageId, channelId, content, config, currentUserId, isOwnMessage, _dependencies_getMessage, translation, current, safeTranslation;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        messageId = typeof (message === null || message === void 0 ? void 0 : message.id) === 'string' ? message.id : null;
                        channelId = channelIdOf(message);
                        content = typeof (message === null || message === void 0 ? void 0 : message.content) === 'string' ? message.content : '';
                        if (!active || !messageId || !channelId || !content.trim() || content.includes(TRANSLATION_MARKER$1) || pending.get(messageId) === workGeneration) return [
                            2
                        ];
                        // Already recorded for the render patch: do not translate twice.
                        if ((_dependencies_decorations = dependencies.decorations) === null || _dependencies_decorations === void 0 ? void 0 : _dependencies_decorations.has(messageId)) return [
                            2
                        ];
                        // Locally injected Clyde/bot replies are ours, not conversation.
                        if ((message === null || message === void 0 ? void 0 : (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.bot) === true) return [
                            2
                        ];
                        config = (_dependencies_config = dependencies.config) === null || _dependencies_config === void 0 ? void 0 : _dependencies_config.for(channelId);
                        currentUserId = (_dependencies_users_getCurrentUser = dependencies.users.getCurrentUser()) === null || _dependencies_users_getCurrentUser === void 0 ? void 0 : _dependencies_users_getCurrentUser.id;
                        isOwnMessage = Boolean(currentUserId) && authorIdOf(message) === currentUserId;
                        if (isOwnMessage) {
                            // Your own message is never sent to the translator: its English original
                            // is already held locally by the outgoing controller.
                            if (config && !config.showOwnEnglish) return [
                                2
                            ];
                            decorateOwnMessage(message, messageId, channelId, content);
                            return [
                                2
                            ];
                        }
                        if (config && !config.incoming) return [
                            2
                        ];
                        pending.set(messageId, workGeneration);
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            dependencies.translate(content)
                        ];
                    case 2:
                        translation = _state.sent();
                        if (!active || workGeneration !== generation || !translation) return [
                            2
                        ];
                        current = (_dependencies_getMessage = dependencies.getMessage(channelId, messageId)) !== null && _dependencies_getMessage !== void 0 ? _dependencies_getMessage : message;
                        if ((current === null || current === void 0 ? void 0 : current.content) !== content) return [
                            2
                        ];
                        safeTranslation = escapeTranslation(translation.text);
                        if (!safeTranslation) return [
                            2
                        ];
                        applyTranslation(current, messageId, channelId, content, safeTranslation);
                        return [
                            3,
                            4
                        ];
                    case 3:
                        if (pending.get(messageId) === workGeneration) pending.delete(messageId);
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    /** Re-attaches your English original beneath a message you sent translated. */ function decorateOwnMessage(message, messageId, channelId, content) {
        var _ref, _dependencies_getMessage;
        var outgoing = dependencies.outgoing;
        if (!outgoing) return;
        var nonce = typeof (message === null || message === void 0 ? void 0 : message.nonce) === 'string' || typeof (message === null || message === void 0 ? void 0 : message.nonce) === 'number' ? String(message.nonce) : null;
        // Prefer the nonce; fall back to matching the sent content, since Discord
        // may replace the nonce we supplied.
        var record = (_ref = nonce ? outgoing.resolveNonce(nonce, messageId) : undefined) !== null && _ref !== void 0 ? _ref : outgoing.resolveSent(channelId, content, messageId);
        if (!record || record.sent !== content) return;
        var safeEnglish = escapeTranslation(record.english);
        if (!safeEnglish) return;
        var current = (_dependencies_getMessage = dependencies.getMessage(channelId, messageId)) !== null && _dependencies_getMessage !== void 0 ? _dependencies_getMessage : message;
        if ((current === null || current === void 0 ? void 0 : current.content) !== content) return;
        applyTranslation(current, messageId, channelId, content, safeEnglish);
    }
    function applyTranslation(current, messageId, channelId, originalContent, line) {
        var _plain_channel_id;
        // Preferred path: record the translation and let the render patch apply it.
        // Discord's store is left untouched, so nothing can overwrite the result.
        if (dependencies.decorations) {
            var _dependencies_requestRerender;
            dependencies.decorations.set(messageId, {
                content: originalContent,
                line: "English: ".concat(line)
            });
            modified.set(messageId, {
                channelId: channelId,
                messageId: messageId,
                originalContent: originalContent,
                decoratedContent: '',
                fallback: current
            });
            (_dependencies_requestRerender = dependencies.requestRerender) === null || _dependencies_requestRerender === void 0 ? void 0 : _dependencies_requestRerender.call(dependencies, channelId, messageId);
            return;
        }
        var decoratedContent = "".concat(originalContent).concat(TRANSLATION_MARKER$1).concat(line);
        var plain = toPlainMessage(current);
        var updated = _object_spread_props$1(_object_spread$2({}, plain), {
            id: messageId,
            channel_id: (_plain_channel_id = plain.channel_id) !== null && _plain_channel_id !== void 0 ? _plain_channel_id : channelId,
            content: decoratedContent
        });
        dependencies.dispatcher.dispatch({
            type: 'MESSAGE_UPDATE',
            message: updated,
            log_edit: false
        });
        modified.set(messageId, {
            channelId: channelId,
            messageId: messageId,
            originalContent: originalContent,
            decoratedContent: decoratedContent,
            fallback: updated
        });
    }
    /**
   * Re-applies a decoration that Discord overwrote.
   *
   * After a send completes, Discord replaces the optimistic message with the
   * server's copy, which has none of our added text. The same happens when a
   * message is edited or re-fetched. Without this, the English line appears for
   * a moment and then vanishes.
   */ function reconcile(messageId) {
        var _plain_channel_id;
        if (!active) return;
        // In decoration mode the store was never modified, so there is nothing to
        // repair: the render patch re-applies the line on every render.
        if (dependencies.decorations) return;
        var entry = modified.get(messageId);
        if (!entry) return;
        var current = dependencies.getMessage(entry.channelId, messageId);
        if (!current) return;
        var content = typeof current.content === 'string' ? current.content : '';
        // Already decorated: nothing to do.
        if (content.includes(TRANSLATION_MARKER$1)) return;
        // The message was genuinely edited to something else, so the stored
        // translation no longer describes it. Drop it rather than mislabel.
        if (content !== entry.originalContent) {
            modified.delete(messageId);
            return;
        }
        var plain = toPlainMessage(current);
        var updated = _object_spread_props$1(_object_spread$2({}, plain), {
            id: messageId,
            channel_id: (_plain_channel_id = plain.channel_id) !== null && _plain_channel_id !== void 0 ? _plain_channel_id : entry.channelId,
            content: entry.decoratedContent
        });
        reconciling = true;
        try {
            dependencies.dispatcher.dispatch({
                type: 'MESSAGE_UPDATE',
                message: updated,
                log_edit: false
            });
        } finally{
            reconciling = false;
        }
        modified.set(messageId, _object_spread_props$1(_object_spread$2({}, entry), {
            fallback: updated
        }));
    }
    var onReconcile = function onReconcile(event) {
        var _event_message;
        // Our own re-application dispatches MESSAGE_UPDATE; ignore that.
        if (!active || reconciling) return;
        var messageId = typeof (event === null || event === void 0 ? void 0 : (_event_message = event.message) === null || _event_message === void 0 ? void 0 : _event_message.id) === 'string' ? event.message.id : typeof (event === null || event === void 0 ? void 0 : event.messageId) === 'string' ? event.messageId : null;
        if (messageId) {
            // Let Discord's own stores settle before re-reading and re-applying.
            setTimeout(function() {
                return reconcile(messageId);
            }, 0);
            return;
        }
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var id = _step.value;
                setTimeout(function() {
                    return reconcile(id);
                }, 0);
            };
            // Some payloads omit the id; re-check everything we have decorated.
            for(var _iterator = _to_consumable_array$4(modified.keys())[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    };
    var onMessageCreate = function onMessageCreate(event) {
        var workGeneration = generation;
        void translateMessage(event === null || event === void 0 ? void 0 : event.message, workGeneration).catch(function(error) {
            if (active && workGeneration === generation && !isAbortError(error)) dependencies.onError(error);
        });
    };
    function processHistoryQueue(workGeneration) {
        return _async_to_generator$2(function() {
            var message, error;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (processingHistoryGeneration === workGeneration) return [
                            2
                        ];
                        processingHistoryGeneration = workGeneration;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            8,
                            9
                        ]);
                        _state.label = 2;
                    case 2:
                        if (!(active && workGeneration === generation && historyQueue.length > 0)) return [
                            3,
                            7
                        ];
                        message = historyQueue.shift();
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            5,
                            ,
                            6
                        ]);
                        return [
                            4,
                            translateMessage(message, workGeneration)
                        ];
                    case 4:
                        _state.sent();
                        return [
                            3,
                            6
                        ];
                    case 5:
                        error = _state.sent();
                        if (active && workGeneration === generation && !isAbortError(error)) dependencies.onError(error);
                        return [
                            3,
                            6
                        ];
                    case 6:
                        return [
                            3,
                            2
                        ];
                    case 7:
                        return [
                            3,
                            9
                        ];
                    case 8:
                        if (processingHistoryGeneration === workGeneration) {
                            processingHistoryGeneration = undefined;
                        }
                        return [
                            7
                        ];
                    case 9:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function enqueueHistory(messages) {
        var _historyQueue;
        if (!active || !Array.isArray(messages) || messages.length === 0) return;
        var workGeneration = generation;
        (_historyQueue = historyQueue).push.apply(_historyQueue, _to_consumable_array$4(messages));
        void processHistoryQueue(workGeneration);
    }
    var onHistoryLoaded = function onHistoryLoaded(event) {
        enqueueHistory(event === null || event === void 0 ? void 0 : event.messages);
    };
    function restoreMessages() {
        // Decoration mode leaves Discord's store untouched; dropping the map is
        // enough, and the next render shows the original text.
        if (dependencies.decorations) {
            dependencies.decorations.clear();
            modified.clear();
            return;
        }
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = modified.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var entry = _step.value;
                var _dependencies_getMessage, _current_channel_id;
                var current = (_dependencies_getMessage = dependencies.getMessage(entry.channelId, entry.messageId)) !== null && _dependencies_getMessage !== void 0 ? _dependencies_getMessage : entry.fallback;
                if ((current === null || current === void 0 ? void 0 : current.content) !== entry.decoratedContent) continue;
                dependencies.dispatcher.dispatch({
                    type: 'MESSAGE_UPDATE',
                    message: _object_spread_props$1(_object_spread$2({}, toPlainMessage(current)), {
                        id: entry.messageId,
                        channel_id: (_current_channel_id = current.channel_id) !== null && _current_channel_id !== void 0 ? _current_channel_id : entry.channelId,
                        content: entry.originalContent
                    }),
                    log_edit: false
                });
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        modified.clear();
    }
    return {
        start: function start() {
            var _dependencies_getLoadedMessages;
            if (active) return;
            generation += 1;
            active = true;
            dependencies.dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = historyActionTypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var type = _step.value;
                    dependencies.dispatcher.subscribe(type, onHistoryLoaded);
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
            try {
                for(var _iterator1 = reconcileActionTypes[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                    var type1 = _step1.value;
                    dependencies.dispatcher.subscribe(type1, onReconcile);
                }
            } catch (err) {
                _didIteratorError1 = true;
                _iteratorError1 = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                        _iterator1.return();
                    }
                } finally{
                    if (_didIteratorError1) {
                        throw _iteratorError1;
                    }
                }
            }
            enqueueHistory((_dependencies_getLoadedMessages = dependencies.getLoadedMessages) === null || _dependencies_getLoadedMessages === void 0 ? void 0 : _dependencies_getLoadedMessages.call(dependencies));
        },
        stop: function stop() {
            if (!active) return;
            active = false;
            dependencies.dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = historyActionTypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var type = _step.value;
                    dependencies.dispatcher.unsubscribe(type, onHistoryLoaded);
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
            try {
                for(var _iterator1 = reconcileActionTypes[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                    var type1 = _step1.value;
                    dependencies.dispatcher.unsubscribe(type1, onReconcile);
                }
            } catch (err) {
                _didIteratorError1 = true;
                _iteratorError1 = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                        _iterator1.return();
                    }
                } finally{
                    if (_didIteratorError1) {
                        throw _iteratorError1;
                    }
                }
            }
            historyQueue.length = 0;
            dependencies.abortTranslations();
            pending.clear();
            restoreMessages();
        }
    };
}function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * Discord syntax must survive a round trip through a machine translator.
 *
 * Mentions, custom emoji, code, links, and spoilers are replaced with
 * invisible sentinels before translation and restored afterwards. If any
 * sentinel does not survive, the caller must treat the translation as
 * unusable rather than send corrupted text.
 */ var SENTINEL = '\u2063';
var PRESERVED_PATTERNS = [
    /```[\s\S]*?```/g,
    /`[^`\n]+`/g,
    /\|\|[\s\S]*?\|\|/g,
    /<a?:\w+:\d+>/g,
    /<(?:@!?|@&|#)\d+>/g,
    /<t:\d+(?::[tTdDfFR])?>/g,
    /<\/[\w-]+:\d+>/g,
    /https?:\/\/\S+/gi,
    /@(?:everyone|here)\b/g
];
function sentinelFor(index) {
    return "".concat(SENTINEL).concat(index).concat(SENTINEL);
}
function maskTokens(input) {
    var tokens = [];
    var text = input;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = PRESERVED_PATTERNS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var pattern = _step.value;
            text = text.replace(new RegExp(pattern.source, pattern.flags), function(match) {
                var index = tokens.push(match) - 1;
                return sentinelFor(index);
            });
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return {
        text: text,
        tokens: tokens
    };
}
/**
 * Restores every masked token.
 *
 * @returns The rebuilt string, or `null` when the translator dropped,
 * duplicated, or mangled a sentinel.
 */ function restoreTokens(text, tokens) {
    var _loop = function(index) {
        var sentinel = sentinelFor(index);
        var occurrences = restored.split(sentinel).length - 1;
        if (occurrences !== 1) return {
            v: null
        };
        restored = restored.replace(sentinel, function() {
            return tokens[index];
        });
    };
    var restored = text;
    for(var index = 0; index < tokens.length; index += 1){
        var _ret = _loop(index);
        if (_type_of$2(_ret) === "object") return _ret.v;
    }
    if (restored.includes(SENTINEL)) return null;
    return restored;
}
/** True when the text carries nothing a translator could meaningfully change. */ function isTranslatableOutgoing(content) {
    var trimmed = content.trim();
    if (!trimmed) return false;
    // Slash commands and Discord's own invocation syntax must never be rewritten.
    if (trimmed.startsWith('/')) return false;
    var text = maskTokens(trimmed).text;
    var withoutSentinels = text.replace(new RegExp("".concat(SENTINEL, "\\d+").concat(SENTINEL), 'g'), '');
    return /[A-Za-z\u00C0-\u02FF\u0370-\u1FFF]/.test(withoutSentinels);
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
/**
 * Text-triggered configuration, handled inside the send patch.
 *
 * Slash commands depend on Discord's command registry resolving, which is not
 * guaranteed across builds. This path only depends on the send interception
 * that outgoing translation already relies on, so if translation works at all,
 * these triggers work too.
 */ var TRIGGER_PREFIX = '!tr';
var SUPPORTED_LANGUAGES$1 = [
    'es',
    'en',
    'pt',
    'fr',
    'de',
    'it',
    'nl',
    'ru',
    'ja',
    'ko',
    'zh',
    'hi',
    'ar',
    'tr',
    'pl',
    'id',
    'vi',
    'th'
];
var ON_WORDS = [
    'on',
    'yes',
    'true',
    '1',
    'enable',
    'enabled'
];
var OFF_WORDS = [
    'off',
    'no',
    'false',
    '0',
    'disable',
    'disabled'
];
function parseFlag(word) {
    if (!word) return undefined;
    var value = word.toLocaleLowerCase();
    if (ON_WORDS.includes(value)) return true;
    if (OFF_WORDS.includes(value)) return false;
    return undefined;
}
function describe(config, channelId) {
    var current = config.for(channelId);
    return [
        '**Translation — this chat**',
        "> Receive: ".concat(current.incoming ? 'on (→ English)' : 'off'),
        "> Send: ".concat(current.outgoing ? "on (→ ".concat(current.outgoingLanguage.toUpperCase(), ")") : 'off'),
        "> Show my English: ".concat(current.showOwnEnglish ? 'on' : 'off')
    ].join('\n');
}
function help() {
    return [
        '**Translation controls** (type in any chat)',
        '`!tr` — show settings for this chat',
        '`!tr on` — translate both directions here',
        '`!tr off` — turn everything off here',
        '`!tr recv on` / `!tr recv off` — messages you receive',
        '`!tr send on` / `!tr send off` — messages you send',
        '`!tr lang es` — language to send in',
        '`!tr eng off` — hide your English under your own messages',
        '',
        'These commands are never sent to the chat.'
    ].join('\n');
}
/**
 * Interprets a trigger message.
 *
 * @returns `handled: false` for anything that is not a trigger, in which case
 * the message must be sent normally.
 */ function handleTrigger(config, channelId, content) {
    var trimmed = content.trim();
    var lower = trimmed.toLocaleLowerCase();
    if (lower !== TRIGGER_PREFIX && !lower.startsWith("".concat(TRIGGER_PREFIX, " "))) {
        return {
            handled: false
        };
    }
    var parts = trimmed.slice(TRIGGER_PREFIX.length).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return {
            handled: true,
            reply: "".concat(describe(config, channelId), "\n\n`!tr help` for options.")
        };
    }
    var _parts = _sliced_to_array(parts, 2), rawCommand = _parts[0], rawValue = _parts[1];
    var command = rawCommand.toLocaleLowerCase();
    if (command === 'help' || command === '?') {
        return {
            handled: true,
            reply: help()
        };
    }
    if (command === 'status') {
        return {
            handled: true,
            reply: describe(config, channelId)
        };
    }
    // `!tr on` / `!tr off` set both directions at once.
    var bothFlag = parseFlag(command);
    if (bothFlag !== undefined) {
        config.setIncoming(channelId, bothFlag);
        config.setOutgoing(channelId, bothFlag);
        return {
            handled: true,
            reply: "Translation **".concat(bothFlag ? 'on' : 'off', "** for this chat.\n\n") + describe(config, channelId)
        };
    }
    if (command === 'recv' || command === 'receive' || command === 'in') {
        var _parseFlag;
        var flag = (_parseFlag = parseFlag(rawValue)) !== null && _parseFlag !== void 0 ? _parseFlag : !config.for(channelId).incoming;
        config.setIncoming(channelId, flag);
        return {
            handled: true,
            reply: "Receive → **".concat(flag ? 'on' : 'off', "**.\n\n").concat(describe(config, channelId))
        };
    }
    if (command === 'send' || command === 'out') {
        var _parseFlag1;
        var flag1 = (_parseFlag1 = parseFlag(rawValue)) !== null && _parseFlag1 !== void 0 ? _parseFlag1 : !config.for(channelId).outgoing;
        config.setOutgoing(channelId, flag1);
        return {
            handled: true,
            reply: "Send → **".concat(flag1 ? 'on' : 'off', "**.\n\n").concat(describe(config, channelId))
        };
    }
    if (command === 'eng' || command === 'english') {
        var _parseFlag2;
        var flag2 = (_parseFlag2 = parseFlag(rawValue)) !== null && _parseFlag2 !== void 0 ? _parseFlag2 : !config.for(channelId).showOwnEnglish;
        config.setShowOwnEnglish(channelId, flag2);
        return {
            handled: true,
            reply: "Show my English → **".concat(flag2 ? 'on' : 'off', "**.\n\n").concat(describe(config, channelId))
        };
    }
    if (command === 'lang' || command === 'language') {
        if (!rawValue) {
            return {
                handled: true,
                reply: "Current send language: **".concat(config.for(channelId).outgoingLanguage.toUpperCase(), "**") + "\n> Set one with `!tr lang es`."
            };
        }
        var language = rawValue.toLocaleLowerCase();
        if (!SUPPORTED_LANGUAGES$1.includes(language.split('-')[0])) {
            return {
                handled: true,
                reply: "**".concat(rawValue, "** is not a recognised language code.\n") + "> Try: ".concat(SUPPORTED_LANGUAGES$1.slice(0, 8).join(', '))
            };
        }
        config.setOutgoingLanguage(channelId, language);
        return {
            handled: true,
            reply: "Send language → **".concat(language.toUpperCase(), "**.\n\n").concat(describe(config, channelId))
        };
    }
    return {
        handled: true,
        reply: "Unknown option `".concat(rawCommand, "`.\n\n").concat(help())
    };
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
}
function asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator$1(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _define_property$1(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _iterable_to_array$3(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread$1(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$1(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$3();
}
function _ts_generator$1(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
var MAX_TRACKED_MESSAGES = 500;
/**
 * Stand-in result for a send we cancelled.
 *
 * Shaped like a successful-but-empty API response so Discord's call site can
 * inspect it without throwing.
 */ var CANCELLED_SEND = Object.freeze({
    ok: true,
    status: 200,
    body: null,
    cancelled: true
});
function contentOf(message) {
    return typeof (message === null || message === void 0 ? void 0 : message.content) === 'string' ? message.content : '';
}
function nonceOf(message) {
    var nonce = message === null || message === void 0 ? void 0 : message.nonce;
    if (typeof nonce === 'string' && nonce) return nonce;
    if (typeof nonce === 'number') return String(nonce);
    return null;
}
function generateNonce() {
    var random = Math.floor(Math.random() * 1e9).toString(36);
    return "rt-".concat(Date.now().toString(36), "-").concat(random);
}
/** Key for the content-based fallback index. */ function contentKey(channelId, content) {
    return "".concat(channelId, ":").concat(content);
}
/**
 * Translates messages you send, before they leave the device.
 *
 * The wire content becomes the target language, so the recipient reads only
 * that. Your English original is kept locally and re-attached to the message
 * once Discord echoes it back with the same nonce.
 */ function createOutgoingController(dependencies) {
    var pendingByNonce = new Map();
    var pendingByContent = new Map();
    var byMessageId = new Map();
    var unpatch;
    var active = false;
    var patchedFunction;
    function remember(messageId, record) {
        byMessageId.set(messageId, record);
        while(byMessageId.size > MAX_TRACKED_MESSAGES){
            var oldest = byMessageId.keys().next().value;
            if (oldest === undefined) break;
            byMessageId.delete(oldest);
        }
    }
    function translateOutgoing(channelId, english, language) {
        return _async_to_generator$1(function() {
            var _maskTokens, text, tokens, translation, restored, _dependencies_onFallback, trimmed;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        _maskTokens = maskTokens(english), text = _maskTokens.text, tokens = _maskTokens.tokens;
                        return [
                            4,
                            dependencies.translate(text, {
                                source: 'en',
                                target: language
                            })
                        ];
                    case 1:
                        translation = _state.sent();
                        if (!translation) return [
                            2,
                            null
                        ];
                        restored = restoreTokens(translation.text, tokens);
                        if (!restored) {
                            (_dependencies_onFallback = dependencies.onFallback) === null || _dependencies_onFallback === void 0 ? void 0 : _dependencies_onFallback.call(dependencies, 'Translation mangled Discord formatting; sent English.');
                            return [
                                2,
                                null
                            ];
                        }
                        trimmed = restored.trim();
                        return [
                            2,
                            trimmed ? trimmed : null
                        ];
                }
            });
        })();
    }
    return {
        start: function start() {
            var _dependencies_messages, _dependencies_messages1;
            if (active) return;
            active = true;
            var before = (_dependencies_messages = dependencies.messages) === null || _dependencies_messages === void 0 ? void 0 : _dependencies_messages.sendMessage;
            unpatch = dependencies.patchInstead(dependencies.messages, 'sendMessage', function(ctx) {
                var args = ctx.args;
                // The entire callback is guarded: this runs inside Discord's send
                // path, so an exception here crashes sending (or the app).
                try {
                    var _ctx, _ctx1, _ctx2;
                    var channelId = typeof args[0] === 'string' ? args[0] : null;
                    var message = args[1];
                    if (!channelId || !message) return (_ctx = ctx).original.apply(_ctx, _to_consumable_array$3(args));
                    var english = contentOf(message);
                    // Configuration triggers are swallowed: never sent, never
                    // translated. Checked before the per-chat gate so a chat can be
                    // switched on from inside itself.
                    var trigger;
                    try {
                        trigger = handleTrigger(dependencies.config, channelId, english);
                    } catch (error) {
                        dependencies.onError(error);
                        trigger = {
                            handled: false
                        };
                    }
                    if (trigger.handled) {
                        try {
                            var _dependencies_onReply;
                            if (trigger.reply) (_dependencies_onReply = dependencies.onReply) === null || _dependencies_onReply === void 0 ? void 0 : _dependencies_onReply.call(dependencies, channelId, trigger.reply);
                        } catch (error) {
                            dependencies.onError(error);
                        }
                        // Must resolve to a thenable: Discord chains on sendMessage's
                        // result, and the patcher turns a bare `undefined` into `null`,
                        // which crashes the send path with "null is not an object".
                        return Promise.resolve(CANCELLED_SEND);
                    }
                    var config = dependencies.config.for(channelId);
                    if (!config.outgoing) return (_ctx1 = ctx).original.apply(_ctx1, _to_consumable_array$3(args));
                    if (!isTranslatableOutgoing(english)) return (_ctx2 = ctx).original.apply(_ctx2, _to_consumable_array$3(args));
                    var language = config.outgoingLanguage;
                    // The send becomes asynchronous: translate first, then hand the
                    // rewritten message to Discord's original implementation.
                    return function() {
                        return _async_to_generator$1(function() {
                            var _ctx, _nonceOf, sent, translated, // Reaching here means the translator declined without
                            // throwing. Say so rather than silently sending English.
                            _dependencies_onFallback, error, _dependencies_onFallback1, nonce, outgoing, record, nextArgs, existingOptions, _ctx1, error1;
                            return _ts_generator$1(this, function(_state) {
                                switch(_state.label){
                                    case 0:
                                        sent = english;
                                        _state.label = 1;
                                    case 1:
                                        _state.trys.push([
                                            1,
                                            3,
                                            ,
                                            4
                                        ]);
                                        return [
                                            4,
                                            translateOutgoing(channelId, english, language)
                                        ];
                                    case 2:
                                        translated = _state.sent();
                                        if (translated) {
                                            sent = translated;
                                        } else {
                                            ;
                                            (_dependencies_onFallback = dependencies.onFallback) === null || _dependencies_onFallback === void 0 ? void 0 : _dependencies_onFallback.call(dependencies, "No ".concat(language.toUpperCase(), " translation available; sent English."));
                                        }
                                        return [
                                            3,
                                            4
                                        ];
                                    case 3:
                                        error = _state.sent();
                                        dependencies.onError(error);
                                        (_dependencies_onFallback1 = dependencies.onFallback) === null || _dependencies_onFallback1 === void 0 ? void 0 : _dependencies_onFallback1.call(dependencies, 'Translation failed; sent English.');
                                        return [
                                            3,
                                            4
                                        ];
                                    case 4:
                                        if (sent === english) return [
                                            2,
                                            (_ctx = ctx).original.apply(_ctx, _to_consumable_array$3(args))
                                        ];
                                        nonce = (_nonceOf = nonceOf(message)) !== null && _nonceOf !== void 0 ? _nonceOf : generateNonce();
                                        outgoing = _object_spread_props(_object_spread$1({}, message), {
                                            content: sent,
                                            nonce: nonce
                                        });
                                        record = {
                                            channelId: channelId,
                                            english: english,
                                            sent: sent,
                                            language: language
                                        };
                                        pendingByNonce.set(nonce, record);
                                        // Discord may assign its own nonce, so also index by content:
                                        // the echo is matched on either key.
                                        pendingByContent.set(contentKey(channelId, sent), record);
                                        nextArgs = _to_consumable_array$3(args);
                                        nextArgs[1] = outgoing;
                                        // The nonce is honoured only in the options argument (index 3);
                                        // `message.nonce` alone is ignored, which leaves the echoed
                                        // message carrying a different nonce than the one we stored.
                                        existingOptions = nextArgs[3];
                                        nextArgs[3] = existingOptions && (typeof existingOptions === "undefined" ? "undefined" : _type_of$1(existingOptions)) === 'object' ? _object_spread_props(_object_spread$1({}, existingOptions), {
                                            nonce: nonce
                                        }) : {
                                            nonce: nonce
                                        };
                                        _state.label = 5;
                                    case 5:
                                        _state.trys.push([
                                            5,
                                            7,
                                            ,
                                            8
                                        ]);
                                        return [
                                            4,
                                            (_ctx1 = ctx).original.apply(_ctx1, _to_consumable_array$3(nextArgs))
                                        ];
                                    case 6:
                                        return [
                                            2,
                                            _state.sent()
                                        ];
                                    case 7:
                                        error1 = _state.sent();
                                        pendingByNonce.delete(nonce);
                                        pendingByContent.delete(contentKey(channelId, sent));
                                        throw error1;
                                    case 8:
                                        return [
                                            2
                                        ];
                                }
                            });
                        })();
                    }();
                } catch (error) {
                    var _ctx3;
                    // Anything unexpected: send the message untouched rather than
                    // breaking Discord.
                    dependencies.onError(error);
                    return (_ctx3 = ctx).original.apply(_ctx3, _to_consumable_array$3(args));
                }
            });
            // The patcher swaps the prop; if it still holds the same function, the
            // write was swallowed (lazy proxy) and nothing is intercepted.
            patchedFunction = (_dependencies_messages1 = dependencies.messages) === null || _dependencies_messages1 === void 0 ? void 0 : _dependencies_messages1.sendMessage;
            if (patchedFunction === before) {
                active = false;
                unpatch === null || unpatch === void 0 ? void 0 : unpatch();
                unpatch = undefined;
            }
        },
        stop: function stop() {
            if (!active) return;
            active = false;
            unpatch === null || unpatch === void 0 ? void 0 : unpatch();
            unpatch = undefined;
            patchedFunction = undefined;
            pendingByNonce.clear();
            pendingByContent.clear();
            byMessageId.clear();
        },
        isActive: function isActive() {
            var _dependencies_messages;
            if (!active) return false;
            // Another plugin or a reload may have restored the original since start.
            return ((_dependencies_messages = dependencies.messages) === null || _dependencies_messages === void 0 ? void 0 : _dependencies_messages.sendMessage) === patchedFunction;
        },
        englishFor: function englishFor(messageId) {
            return byMessageId.get(messageId);
        },
        resolveNonce: function resolveNonce(nonce, messageId) {
            var record = pendingByNonce.get(nonce);
            if (!record) return byMessageId.get(messageId);
            pendingByNonce.delete(nonce);
            pendingByContent.delete(contentKey(record.channelId, record.sent));
            remember(messageId, record);
            return record;
        },
        resolveSent: function resolveSent(channelId, content, messageId) {
            var known = byMessageId.get(messageId);
            if (known) return known;
            var key = contentKey(channelId, content);
            var record = pendingByContent.get(key);
            if (!record) return undefined;
            pendingByContent.delete(key);
            remember(messageId, record);
            return record;
        },
        pendingNonces: function pendingNonces() {
            return pendingByNonce.size;
        }
    };
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
}
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$2();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
/** Discord's own enum values; BUILT_IN keeps the command client-side. */ var APPLICATION_COMMAND_TYPE_CHAT = 1;
var APPLICATION_COMMAND_INPUT_TYPE_BUILT_IN = 0;
var OPTION_TYPE_BOOLEAN = 5;
var OPTION_TYPE_STRING = 3;
var SUPPORTED_LANGUAGES = [
    'es',
    'en',
    'pt',
    'fr',
    'de',
    'it',
    'nl',
    'ru',
    'ja',
    'ko',
    'zh',
    'hi',
    'ar',
    'tr',
    'pl',
    'id',
    'vi',
    'th'
];
function booleanArg(args, name) {
    var arg = args.find(function(entry) {
        return (entry === null || entry === void 0 ? void 0 : entry.name) === name;
    });
    if (!arg) return undefined;
    if (typeof arg.value === 'boolean') return arg.value;
    if (arg.value === 'true') return true;
    if (arg.value === 'false') return false;
    return undefined;
}
function stringArg(args, name) {
    var arg = args.find(function(entry) {
        return (entry === null || entry === void 0 ? void 0 : entry.name) === name;
    });
    if (!arg || typeof arg.value !== 'string') return undefined;
    var trimmed = arg.value.trim();
    return trimmed ? trimmed : undefined;
}
function formatStatus(config, channelId) {
    var current = config.for(channelId);
    var language = current.outgoingLanguage.toUpperCase();
    return [
        '**Translation — this chat**',
        "> Receive: ".concat(current.incoming ? "on (→ English)" : 'off'),
        "> Send: ".concat(current.outgoing ? "on (→ ".concat(language, ")") : 'off'),
        "> Show my English: ".concat(current.showOwnEnglish ? 'on' : 'off'),
        '',
        '`/translate receive:True send:True` to enable both here.'
    ].join('\n');
}
/**
 * Registers chat-input commands so a chat can be configured without leaving it.
 *
 * Discord builds its command list through `getBuiltInCommands`, so appending to
 * that result is the stable way to add one: no Discord component is patched and
 * nothing in the message list is touched.
 */ function createCommandController(dependencies) {
    var config = dependencies.config;
    var unpatch;
    var registered = [];
    var idBase = '-1000';
    function channelIdFrom(ctx) {
        var _ctx_channel;
        var id = ctx === null || ctx === void 0 ? void 0 : (_ctx_channel = ctx.channel) === null || _ctx_channel === void 0 ? void 0 : _ctx_channel.id;
        return typeof id === 'string' && id ? id : null;
    }
    function nextCommandId() {
        try {
            var _Math;
            var builtIn = dependencies.commands.getBuiltInCommands(APPLICATION_COMMAND_TYPE_CHAT, true, false);
            var ids = builtIn.map(function(command) {
                var _ref;
                return parseInt(String((_ref = command === null || command === void 0 ? void 0 : command.id) !== null && _ref !== void 0 ? _ref : '0'), 10);
            }).filter(function(value) {
                return Number.isFinite(value);
            });
            var lowest = ids.length ? (_Math = Math).min.apply(_Math, _to_consumable_array$2(ids)) : 0;
            // Stay strictly negative so we can never shadow a Discord command id.
            return String(Math.min(lowest, 0) - 1);
        } catch (unused) {
            return '-1000';
        }
    }
    function decorate(command, offset) {
        var // One base id per registration, then a unique negative id per command.
        _command, _id, _command1, _applicationId, _command2, _type, _command3, _displayName, _command4, _untranslatedName, _command5, _displayDescription, _command6, _untranslatedDescription, _command_options;
        (_id = (_command = command).id) !== null && _id !== void 0 ? _id : _command.id = String(parseInt(idBase, 10) - offset);
        (_applicationId = (_command1 = command).applicationId) !== null && _applicationId !== void 0 ? _applicationId : _command1.applicationId = '-1';
        (_type = (_command2 = command).type) !== null && _type !== void 0 ? _type : _command2.type = APPLICATION_COMMAND_TYPE_CHAT;
        command.inputType = APPLICATION_COMMAND_INPUT_TYPE_BUILT_IN;
        (_displayName = (_command3 = command).displayName) !== null && _displayName !== void 0 ? _displayName : _command3.displayName = command.name;
        (_untranslatedName = (_command4 = command).untranslatedName) !== null && _untranslatedName !== void 0 ? _untranslatedName : _command4.untranslatedName = command.name;
        (_displayDescription = (_command5 = command).displayDescription) !== null && _displayDescription !== void 0 ? _displayDescription : _command5.displayDescription = command.description;
        (_untranslatedDescription = (_command6 = command).untranslatedDescription) !== null && _untranslatedDescription !== void 0 ? _untranslatedDescription : _command6.untranslatedDescription = command.description;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_command_options = command.options) !== null && _command_options !== void 0 ? _command_options : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var option = _step.value;
                var _option, _displayName1, _option1, _displayDescription1;
                (_displayName1 = (_option = option).displayName) !== null && _displayName1 !== void 0 ? _displayName1 : _option.displayName = option.name;
                (_displayDescription1 = (_option1 = option).displayDescription) !== null && _displayDescription1 !== void 0 ? _displayDescription1 : _option1.displayDescription = option.description;
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        return command;
    }
    function buildCommands() {
        var translate = {
            name: 'translate',
            description: 'Turn translation on or off for this chat.',
            options: [
                {
                    name: 'receive',
                    description: 'Show English beneath messages you receive here.',
                    type: OPTION_TYPE_BOOLEAN
                },
                {
                    name: 'send',
                    description: 'Send your messages in another language in this chat.',
                    type: OPTION_TYPE_BOOLEAN
                },
                {
                    name: 'language',
                    description: 'Language to send in, for example es. Default es.',
                    type: OPTION_TYPE_STRING
                },
                {
                    name: 'show_english',
                    description: 'Keep your English visible under your own messages.',
                    type: OPTION_TYPE_BOOLEAN
                }
            ],
            execute: function execute(args, ctx) {
                var channelId = channelIdFrom(ctx);
                if (!channelId) return;
                var receive = booleanArg(args, 'receive');
                var send = booleanArg(args, 'send');
                var showEnglish = booleanArg(args, 'show_english');
                var language = stringArg(args, 'language');
                // No arguments: report the current state instead of changing it.
                if (receive === undefined && send === undefined && showEnglish === undefined && language === undefined) {
                    dependencies.reply(channelId, formatStatus(config, channelId));
                    return;
                }
                var changes = [];
                if (language !== undefined) {
                    var normalized = language.toLocaleLowerCase();
                    if (!SUPPORTED_LANGUAGES.includes(normalized.split('-')[0])) {
                        dependencies.reply(channelId, "**".concat(language, "** is not a recognised language code.\n") + "> Try one of: ".concat(SUPPORTED_LANGUAGES.slice(0, 8).join(', ')));
                        return;
                    }
                    config.setOutgoingLanguage(channelId, normalized);
                    changes.push("send language → **".concat(normalized.toUpperCase(), "**"));
                }
                if (receive !== undefined) {
                    config.setIncoming(channelId, receive);
                    changes.push("receive → **".concat(receive ? 'on' : 'off', "**"));
                }
                if (send !== undefined) {
                    config.setOutgoing(channelId, send);
                    changes.push("send → **".concat(send ? 'on' : 'off', "**"));
                }
                if (showEnglish !== undefined) {
                    config.setShowOwnEnglish(channelId, showEnglish);
                    changes.push("show my English → **".concat(showEnglish ? 'on' : 'off', "**"));
                }
                dependencies.reply(channelId, "Updated ".concat(changes.join(', '), ".\n\n").concat(formatStatus(config, channelId)));
            }
        };
        var translateOff = {
            name: 'translate-off',
            description: 'Turn all translation off for this chat.',
            options: [],
            execute: function execute(_args, ctx) {
                var channelId = channelIdFrom(ctx);
                if (!channelId) return;
                config.reset(channelId);
                dependencies.reply(channelId, "Translation is now **off** in this chat, both directions.");
            }
        };
        var translateStatus = {
            name: 'translate-status',
            description: 'Show translation settings for this chat.',
            options: [],
            execute: function execute(_args, ctx) {
                var channelId = channelIdFrom(ctx);
                if (!channelId) return;
                dependencies.reply(channelId, formatStatus(config, channelId));
            }
        };
        return [
            translate,
            translateOff,
            translateStatus
        ].map(decorate);
    }
    return {
        start: function start() {
            if (unpatch) return;
            var target = dependencies.commands;
            if (!target || typeof target.getBuiltInCommands !== 'function') {
                throw new Error('Discord command registry is not available.');
            }
            idBase = nextCommandId();
            registered = buildCommands();
            unpatch = dependencies.patchAfter(dependencies.commands, 'getBuiltInCommands', function(args, result) {
                if (!Array.isArray(result)) return result;
                var requestedType = args[0];
                var matches = function matches(command) {
                    return Array.isArray(requestedType) ? requestedType.includes(command.type) : requestedType === command.type;
                };
                return _to_consumable_array$2(result).concat(_to_consumable_array$2(registered.filter(matches)));
            });
        },
        stop: function stop() {
            unpatch === null || unpatch === void 0 ? void 0 : unpatch();
            unpatch = undefined;
            registered = [];
        },
        definitions: function definitions() {
            return registered;
        }
    };
}/**
 * Render-path decoration, the approach BetterDiscord's Translator uses.
 *
 * Writing a translation into Discord's message store does not last: the server
 * copy replaces it after a send and whenever a channel is re-fetched, so the
 * added line appears and then vanishes. BetterDiscord never touches the store.
 * It keeps translations in a plain map and patches the render path, so the text
 * is re-applied on every render and there is nothing for the server to
 * overwrite.
 *
 * Mobile Discord renders messages through `RowManager.generate`, which turns a
 * message record into the row the list draws. Appending to the content there is
 * the mobile equivalent of BetterDiscord's `processMessageContent`.
 */ var TRANSLATION_MARKER = '\n-# ↳ ';
/**
 * Appends the decoration to a generated row.
 *
 * Exported for testing: it is the whole behaviour, independent of how the
 * patch is installed.
 */ function decorateRow(row, getDecoration) {
    var message = row === null || row === void 0 ? void 0 : row.message;
    var messageId = typeof (message === null || message === void 0 ? void 0 : message.id) === 'string' ? message.id : null;
    if (!messageId) return;
    var content = typeof message.content === 'string' ? message.content : '';
    if (!content || content.includes(TRANSLATION_MARKER)) return;
    var decoration = getDecoration(messageId);
    if (!decoration || !decoration.line) return;
    // The stored translation describes different text: leave the row alone rather
    // than label an edited message with a stale translation.
    if (decoration.content !== content) return;
    message.content = "".concat(content).concat(TRANSLATION_MARKER).concat(decoration.line);
}
function createRenderController(dependencies) {
    var unpatch;
    return {
        start: function start() {
            var _dependencies_rowManager;
            if (unpatch) return true;
            var prototype = (_dependencies_rowManager = dependencies.rowManager) === null || _dependencies_rowManager === void 0 ? void 0 : _dependencies_rowManager.prototype;
            if (!prototype || typeof prototype.generate !== 'function') return false;
            var before = prototype.generate;
            unpatch = dependencies.patchAfter(prototype, 'generate', function(_args, result) {
                try {
                    decorateRow(result, dependencies.getDecoration);
                } catch (error) {
                    // A throw here would break the message list; never let that happen.
                    dependencies.onError(error);
                }
                return result;
            });
            // Confirm the patch took: a lazy proxy swallows defineProperty silently.
            if (prototype.generate === before) {
                unpatch();
                unpatch = undefined;
                return false;
            }
            return true;
        },
        stop: function stop() {
            unpatch === null || unpatch === void 0 ? void 0 : unpatch();
            unpatch = undefined;
        },
        isActive: function isActive() {
            return Boolean(unpatch);
        }
    };
}/**
 * The translation map, modelled on BetterDiscord's `translatedMessages`.
 *
 * Translations live here and nowhere else. Discord's message store is never
 * modified, so nothing the server sends can erase them; the render patch reads
 * this map on every row it builds.
 */ var MAX_ENTRIES = 1000;
function createDecorationStore() {
    var maxEntries = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : MAX_ENTRIES;
    var entries = new Map();
    return {
        set: function set(messageId, decoration) {
            entries.delete(messageId);
            entries.set(messageId, decoration);
            while(entries.size > maxEntries){
                var oldest = entries.keys().next().value;
                if (oldest === undefined) break;
                entries.delete(oldest);
            }
        },
        get: function get(messageId) {
            return entries.get(messageId);
        },
        has: function has(messageId) {
            return entries.has(messageId);
        },
        delete: function _delete(messageId) {
            entries.delete(messageId);
        },
        clear: function clear() {
            entries.clear();
        },
        size: function size() {
            return entries.size;
        }
    };
}/**
 * Unbound exposes Discord modules through `lazy()` proxies.
 *
 * That proxy forwards `get`/`set`/`has`/`ownKeys` to the real module but has no
 * `defineProperty` trap, so `Object.defineProperty` — which is how the patcher
 * installs a patch — lands on the proxy's empty backing object instead of the
 * module. The patch then silently does nothing: no error, no interception.
 *
 * Reading any property forces the proxy to resolve, so re-finding the module
 * through metro yields the real object, which can be patched.
 */ function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread$1();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
/**
 * Resolves a patchable reference to a Discord module.
 *
 * @param candidate The possibly-proxied module (e.g. `metro.api.Messages`).
 * @param props Properties identifying the module, for re-resolution.
 * @returns A directly patchable object.
 * @throws When no object exposing every prop as a function can be found.
 */ function resolvePatchTarget(candidate, props, dependencies) {
    // Touch a prop so a lazy proxy resolves and metro's cache is warm.
    var reachable = function reachable(value) {
        if (!value || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== 'object' && typeof value !== 'function') return false;
        return props.every(function(prop) {
            return typeof value[prop] === 'function';
        });
    };
    var viaCandidate = function() {
        try {
            return reachable(candidate) ? candidate : null;
        } catch (unused) {
            return null;
        }
    }();
    // A direct metro lookup returns the module itself rather than a proxy.
    var direct = null;
    try {
        var _dependencies;
        direct = (_dependencies = dependencies).findByProps.apply(_dependencies, _to_consumable_array$1(props));
    } catch (unused) {
        direct = null;
    }
    if (reachable(direct) && isPatchable(direct, props[0])) return direct;
    if (viaCandidate && isPatchable(viaCandidate, props[0])) return viaCandidate;
    if (reachable(direct)) return direct;
    if (viaCandidate) return viaCandidate;
    throw new Error("Could not resolve a patchable module for: ".concat(props.join(', ')));
}
/**
 * Checks that `Object.defineProperty` actually takes on this object.
 *
 * A lazy proxy accepts the call and discards it, so the only reliable test is
 * to write a sentinel and read it back.
 */ function isPatchable(target, prop) {
    var original = target === null || target === void 0 ? void 0 : target[prop];
    if (typeof original !== 'function') return false;
    var sentinel = function sentinel() {};
    try {
        Object.defineProperty(target, prop, {
            value: sentinel,
            configurable: true,
            enumerable: true,
            writable: true
        });
        var applied = target[prop] === sentinel;
        // Always restore, whether or not the write took.
        Object.defineProperty(target, prop, {
            value: original,
            configurable: true,
            enumerable: true,
            writable: true
        });
        return applied;
    } catch (unused) {
        try {
            Object.defineProperty(target, prop, {
                value: original,
                configurable: true,
                enumerable: true,
                writable: true
            });
        } catch (unused) {
        // Nothing further can be done; report unpatchable.
        }
        return false;
    }
}function toMessageArray(messages) {
    if (Array.isArray(messages)) return messages;
    if (Array.isArray(messages === null || messages === void 0 ? void 0 : messages._array)) return messages._array;
    var converted = typeof (messages === null || messages === void 0 ? void 0 : messages.toArray) === 'function' ? messages.toArray() : undefined;
    if (Array.isArray(converted)) return converted;
    if (Array.isArray(messages === null || messages === void 0 ? void 0 : messages.array)) return messages.array;
    if (messages && typeof messages[Symbol.iterator] === 'function') {
        return Array.from(messages);
    }
    return [];
}
function getSelectedChannelMessages(selectedChannelStore, messageStore) {
    var _selectedChannelStore_getChannelId, _messageStore_getMessages;
    var selectedChannelId = selectedChannelStore === null || selectedChannelStore === void 0 ? void 0 : (_selectedChannelStore_getChannelId = selectedChannelStore.getChannelId) === null || _selectedChannelStore_getChannelId === void 0 ? void 0 : _selectedChannelStore_getChannelId.call(selectedChannelStore);
    if (typeof selectedChannelId !== 'string') return [];
    return toMessageArray(messageStore === null || messageStore === void 0 ? void 0 : (_messageStore_getMessages = messageStore.getMessages) === null || _messageStore_getMessages === void 0 ? void 0 : _messageStore_getMessages.call(messageStore, selectedChannelId));
}function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
var DEFAULT_TRANSLATION_ENDPOINT = 'https://clients5.google.com/translate_a/t';
function normalized(text) {
    return text.trim().replace(/\s+/g, ' ');
}
function comparable(text) {
    return normalized(text).toLocaleLowerCase();
}
function baseLanguage(value) {
    var _value_toLocaleLowerCase_split_;
    return (_value_toLocaleLowerCase_split_ = value.toLocaleLowerCase().split('-')[0]) !== null && _value_toLocaleLowerCase_split_ !== void 0 ? _value_toLocaleLowerCase_split_ : '';
}
function hasTranslatableText(text) {
    var withoutDiscordSyntax = text.replace(/https?:\/\/\S+/gi, '').replace(/<a?:\w+:\d+>/g, '').replace(/<(?:@!?|@&|#)\d+>/g, '').replace(/<t:\d+(?::[tTdDfFR])?>/g, '').replace(/<\/[\w-]+:\d+>/g, '');
    return /[A-Za-z0-9\u00C0-\u02FF\u0370-\u1FFF\u2C00-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]/.test(withoutDiscordSyntax);
}
/**
 * Parses the endpoint's response.
 *
 * The shape depends on the request: an explicit source language returns a flat
 * `["translated"]`, while `sl=auto` returns a nested `[["translated","src"]]`
 * (or segment arrays for longer text). All three forms are handled, because
 * outbound translation always passes an explicit source.
 */ function parseGoogleTranslation(payload) {
    if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error('Translation endpoint returned an unexpected response.');
    }
    // Flat form: explicit `sl`, e.g. ["lo enviaré mañana"]. No detected language.
    if (typeof payload[0] === 'string') {
        var text = payload[0].trim();
        if (!text) throw new Error('Translation endpoint returned no translated text.');
        return {
            text: text,
            detectedLanguage: ''
        };
    }
    if (!Array.isArray(payload[0])) {
        throw new Error('Translation endpoint returned an unexpected response.');
    }
    // Nested single form: [["translated","es"]]
    if (typeof payload[0][0] === 'string') {
        var text1 = payload[0][0].trim();
        var detectedLanguage = typeof payload[0][1] === 'string' ? payload[0][1] : '';
        if (!text1) throw new Error('Translation endpoint returned no translated text.');
        return {
            text: text1,
            detectedLanguage: detectedLanguage
        };
    }
    // Segmented form: [[["seg one"],["seg two"]], …, "es"]
    var text2 = payload[0].map(function(segment) {
        return Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : '';
    }).join('').trim();
    var detectedLanguage1 = typeof payload[2] === 'string' ? payload[2] : '';
    if (!text2) {
        throw new Error('Translation endpoint returned no translated text.');
    }
    return {
        text: text2,
        detectedLanguage: detectedLanguage1
    };
}
function createTranslationClient() {
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    var _options_endpoint, _options_fetchImpl, _options_maxCacheEntries, _options_timeoutMs;
    var endpoint = (_options_endpoint = options.endpoint) !== null && _options_endpoint !== void 0 ? _options_endpoint : DEFAULT_TRANSLATION_ENDPOINT;
    var fetchImpl = (_options_fetchImpl = options.fetchImpl) !== null && _options_fetchImpl !== void 0 ? _options_fetchImpl : globalThis.fetch;
    var maxCacheEntries = (_options_maxCacheEntries = options.maxCacheEntries) !== null && _options_maxCacheEntries !== void 0 ? _options_maxCacheEntries : 250;
    var timeoutMs = (_options_timeoutMs = options.timeoutMs) !== null && _options_timeoutMs !== void 0 ? _options_timeoutMs : 12000;
    var cache = new Map();
    var inFlight = new Map();
    var controllers = new Set();
    var aborted = false;
    function readCache(key) {
        var _cache_get;
        if (!cache.has(key)) return {
            hit: false,
            value: null
        };
        var value = (_cache_get = cache.get(key)) !== null && _cache_get !== void 0 ? _cache_get : null;
        cache.delete(key);
        cache.set(key, value);
        return {
            hit: true,
            value: value
        };
    }
    function writeCache(key, value) {
        cache.delete(key);
        cache.set(key, value);
        while(cache.size > maxCacheEntries){
            var oldest = cache.keys().next().value;
            if (oldest === undefined) break;
            cache.delete(oldest);
        }
    }
    function request(text, source, target) {
        return _async_to_generator(function() {
            var controller, timeout, separator, url, response, translation, detected;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        controller = new AbortController();
                        timeout = setTimeout(function() {
                            return controller.abort();
                        }, timeoutMs);
                        controllers.add(controller);
                        separator = endpoint.includes('?') ? '&' : '?';
                        url = "".concat(endpoint).concat(separator, "client=dict-chrome-ex") + "&sl=".concat(encodeURIComponent(source)) + "&tl=".concat(encodeURIComponent(target));
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            4,
                            5
                        ]);
                        return [
                            4,
                            fetchImpl(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                                },
                                body: "q=".concat(encodeURIComponent(text)),
                                signal: controller.signal
                            })
                        ];
                    case 2:
                        response = _state.sent();
                        if (!response.ok) {
                            throw new Error("Translation endpoint failed with HTTP ".concat(response.status, "."));
                        }
                        return [
                            4,
                            response.json()
                        ];
                    case 3:
                        translation = parseGoogleTranslation.apply(void 0, [
                            _state.sent()
                        ]);
                        detected = baseLanguage(translation.detectedLanguage);
                        // Nothing was gained: the endpoint says the text is already the target.
                        if (detected && detected === baseLanguage(target)) return [
                            2,
                            null
                        ];
                        // Identical output is only meaningless when the languages match. A word
                        // like "ok" legitimately translates to itself, and discarding it here
                        // would silently send the untranslated original.
                        if (baseLanguage(source) === baseLanguage(target) && comparable(translation.text) === comparable(text)) return [
                            2,
                            null
                        ];
                        return [
                            2,
                            translation
                        ];
                    case 4:
                        clearTimeout(timeout);
                        controllers.delete(controller);
                        return [
                            7
                        ];
                    case 5:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return {
        translate: function translate(text) {
            var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
            var _options_source, _options_target;
            var input = text.trim();
            if (aborted || !input || !hasTranslatableText(input)) return Promise.resolve(null);
            var source = ((_options_source = options.source) === null || _options_source === void 0 ? void 0 : _options_source.trim().toLocaleLowerCase()) || 'auto';
            var target = ((_options_target = options.target) === null || _options_target === void 0 ? void 0 : _options_target.trim().toLocaleLowerCase()) || 'en';
            var key = "".concat(source, ">").concat(target, ":").concat(normalized(input));
            var cached = readCache(key);
            if (cached.hit) return Promise.resolve(cached.value);
            var pending = inFlight.get(key);
            if (pending) return pending;
            var promise = request(input, source, target).then(function(result) {
                writeCache(key, result);
                return result;
            }).finally(function() {
                inFlight.delete(key);
            });
            inFlight.set(key, promise);
            return promise;
        },
        abort: function abort() {
            aborted = true;
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = controllers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var controller = _step.value;
                    controller.abort();
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
            controllers.clear();
            inFlight.clear();
        }
    };
}/**
 * Settings panel scoped to the chat you currently have open.
 *
 * Unbound renders this from the plugin card, so the panel reads the selected
 * channel at render time: open a DM, open the plugin settings, and the toggles
 * apply to that conversation only.
 */ function buildSettingsPanel() {
    var React = window.unbound.metro.common.React;
    var components = window.unbound.metro.components;
    var TableRowGroup = components.TableRowGroup, TableSwitchRow = components.TableSwitchRow, TableRow = components.TableRow, Text = components.Text;
    return React.createElement(function TranslatorSettings() {
        var _selectedChannelStore_getChannelId, _channelStore_getChannel, _channel_rawRecipients;
        var store = window.unbound.storage.useSettingsStore(STORE_NAME);
        var config = createChatConfig(store);
        var selectedChannelStore = window.unbound.metro.findStore('SelectedChannel');
        var channelStore = window.unbound.metro.findStore('Channel');
        var channelId = selectedChannelStore === null || selectedChannelStore === void 0 ? void 0 : (_selectedChannelStore_getChannelId = selectedChannelStore.getChannelId) === null || _selectedChannelStore_getChannelId === void 0 ? void 0 : _selectedChannelStore_getChannelId.call(selectedChannelStore);
        var channel = typeof channelId === 'string' ? channelStore === null || channelStore === void 0 ? void 0 : (_channelStore_getChannel = channelStore.getChannel) === null || _channelStore_getChannel === void 0 ? void 0 : _channelStore_getChannel.call(channelStore, channelId) : null;
        if (typeof channelId !== 'string' || !channelId) {
            return React.createElement(TableRowGroup, {
                title: 'Realtime Translator'
            }, React.createElement(TableRow, {
                label: 'No chat open',
                subLabel: 'Open a DM or group chat, then reopen this panel to configure it.'
            }));
        }
        var label = (channel === null || channel === void 0 ? void 0 : channel.name) || (channel === null || channel === void 0 ? void 0 : (_channel_rawRecipients = channel.rawRecipients) === null || _channel_rawRecipients === void 0 ? void 0 : _channel_rawRecipients.map(function(user) {
            return user.username;
        }).join(', ')) || "Channel ".concat(channelId);
        var current = config.for(channelId);
        return React.createElement(TableRowGroup, {
            title: "Translation — ".concat(label)
        }, React.createElement(TableSwitchRow, {
            label: 'Translate messages I receive',
            subLabel: 'Shows an English line beneath incoming non-English messages.',
            value: current.incoming,
            onValueChange: function onValueChange(value) {
                return config.setIncoming(channelId, value);
            }
        }), React.createElement(TableSwitchRow, {
            label: 'Translate messages I send',
            subLabel: "Sends ".concat(current.outgoingLanguage.toUpperCase(), " to this chat ") + 'instead of your English.',
            value: current.outgoing,
            onValueChange: function onValueChange(value) {
                return config.setOutgoing(channelId, value);
            }
        }), React.createElement(TableSwitchRow, {
            label: 'Show my English underneath',
            subLabel: 'Keeps your original English visible on your own messages.',
            value: current.showOwnEnglish,
            disabled: !current.outgoing,
            onValueChange: function onValueChange(value) {
                return config.setShowOwnEnglish(channelId, value);
            }
        }), React.createElement(TableRow, {
            label: 'Send language',
            subLabel: "Currently ".concat(current.outgoingLanguage, ". ") + "Default ".concat(DEFAULT_OUTGOING_LANGUAGE, " (Spanish)."),
            trailing: React.createElement(Text, {
                variant: 'text-md/medium'
            }, current.outgoingLanguage.toUpperCase()),
            onPress: function onPress() {
                // Cycles the common targets; edit settings.json for anything else.
                var cycle = [
                    'es',
                    'en',
                    'pt',
                    'fr',
                    'de'
                ];
                var next = cycle[(cycle.indexOf(current.outgoingLanguage) + 1) % cycle.length];
                config.setOutgoingLanguage(channelId, next);
            }
        }));
    });
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
var controller;
var outgoing;
var commands;
var render;
function warn(message) {
    try {
        window.unbound.toasts.showToast({
            content: message
        });
    } catch (unused) {
    // Toasts are cosmetic; never let one break a send.
    }
}
/**
 * Posts a local-only reply in the channel.
 *
 * Prefers Discord's own `sendBotMessage`, which builds and inserts the message
 * itself. Falls back to constructing a Clyde message, then to a toast. Nothing
 * here may throw: this runs inside the send patch, and an exception would take
 * Discord's send path down with it.
 */ function reply(channelId, content) {
    try {
        var messageUtil = window.unbound.metro.findByProps('sendBotMessage');
        if (typeof (messageUtil === null || messageUtil === void 0 ? void 0 : messageUtil.sendBotMessage) === 'function') {
            messageUtil.sendBotMessage(channelId, content);
            return;
        }
    } catch (error) {
        console.warn('[Realtime Translator] sendBotMessage failed:', error);
    }
    try {
        var message = window.unbound.metro.common.Clyde.createBotMessage({
            channelId: channelId,
            content: content
        });
        window.unbound.metro.common.Dispatcher.dispatch({
            type: 'MESSAGE_CREATE',
            message: message
        });
        return;
    } catch (error) {
        console.warn('[Realtime Translator] Clyde reply failed:', error);
    }
    // Last resort: at least acknowledge that the setting changed.
    warn(content.replace(/[*>`]/g, '').split('\n').slice(0, 2).join(' — '));
}
var index = {
    start: function start() {
        var _metro, _metro1;
        if (controller) return;
        var translator = createTranslationClient();
        var config = createChatConfig(window.unbound.storage.getStore(STORE_NAME));
        var messageStore = window.unbound.metro.findStore('Message');
        var selectedChannelStore = window.unbound.metro.findStore('SelectedChannel');
        var decorations = createDecorationStore();
        // Patch the render path, as BetterDiscord's Translator does, so Discord's
        // message store is never modified and the server cannot erase the added
        // line. Falls back to local store updates when the row renderer cannot be
        // found on this build.
        var rowManager = window.unbound.metro.findByName('RowManager');
        render = createRenderController({
            rowManager: rowManager,
            patchAfter: function patchAfter(parent, method, callback) {
                return window.unbound.patcher.after(parent, method, function(ctx) {
                    return callback(ctx.args, ctx.result);
                }, {
                    caller: STORE_NAME
                });
            },
            getDecoration: function getDecoration(messageId) {
                return decorations.get(messageId);
            },
            onError: function onError(error) {
                return console.warn('[Realtime Translator] Row render failed:', error);
            }
        });
        var renderPatched = function() {
            try {
                return render.start();
            } catch (error) {
                console.warn('[Realtime Translator] Could not patch the row renderer:', error);
                return false;
            }
        }();
        if (!renderPatched) {
            render = undefined;
            console.warn('[Realtime Translator] Row renderer unavailable;' + ' falling back to local message updates, which Discord may overwrite.');
        }
        /** Nudges the row for one message to re-render without editing the store. */ var requestRerender = function requestRerender(channelId, messageId) {
            try {
                var _messageStore_getMessage;
                var message = messageStore === null || messageStore === void 0 ? void 0 : (_messageStore_getMessage = messageStore.getMessage) === null || _messageStore_getMessage === void 0 ? void 0 : _messageStore_getMessage.call(messageStore, channelId, messageId);
                if (!message) return;
                window.unbound.metro.common.Dispatcher.dispatch({
                    type: 'MESSAGE_UPDATE',
                    message: typeof message.toJS === 'function' ? message.toJS() : _object_spread({}, message),
                    log_edit: false
                });
            } catch (error) {
                console.warn('[Realtime Translator] Re-render request failed:', error);
            }
        };
        outgoing = createOutgoingController({
            messages: resolvePatchTarget(window.unbound.metro.api.Messages, [
                'sendMessage',
                'receiveMessage'
            ], {
                findByProps: function findByProps() {
                    for(var _len = arguments.length, props = new Array(_len), _key = 0; _key < _len; _key++){
                        props[_key] = arguments[_key];
                    }
                    return (_metro = window.unbound.metro).findByProps.apply(_metro, _to_consumable_array(props));
                }
            }),
            config: config,
            translate: function translate(text, options) {
                return translator.translate(text, options);
            },
            patchInstead: function patchInstead(parent, method, callback) {
                return window.unbound.patcher.instead(parent, method, callback, {
                    caller: STORE_NAME
                });
            },
            onError: function onError(error) {
                return console.warn('[Realtime Translator] Outgoing failed:', error);
            },
            onFallback: warn,
            onReply: reply
        });
        controller = createRealtimeController({
            dispatcher: window.unbound.metro.common.Dispatcher,
            users: window.unbound.metro.stores.Users,
            config: config,
            outgoing: outgoing,
            decorations: renderPatched ? decorations : undefined,
            requestRerender: renderPatched ? requestRerender : undefined,
            getMessage: function getMessage(channelId, messageId) {
                var _messageStore_getMessage;
                return messageStore === null || messageStore === void 0 ? void 0 : (_messageStore_getMessage = messageStore.getMessage) === null || _messageStore_getMessage === void 0 ? void 0 : _messageStore_getMessage.call(messageStore, channelId, messageId);
            },
            getLoadedMessages: function getLoadedMessages() {
                return getSelectedChannelMessages(selectedChannelStore, messageStore);
            },
            translate: function translate(text) {
                return translator.translate(text, {
                    source: 'auto',
                    target: 'en'
                });
            },
            abortTranslations: translator.abort,
            onError: function onError(error) {
                return console.warn('[Realtime Translator] Translation failed:', error);
            }
        });
        commands = createCommandController({
            commands: resolvePatchTarget(window.unbound.metro.common.Commands, [
                'getBuiltInCommands'
            ], {
                findByProps: function findByProps() {
                    for(var _len = arguments.length, props = new Array(_len), _key = 0; _key < _len; _key++){
                        props[_key] = arguments[_key];
                    }
                    return (_metro1 = window.unbound.metro).findByProps.apply(_metro1, _to_consumable_array(props));
                }
            }),
            config: config,
            patchAfter: function patchAfter(parent, method, callback) {
                return window.unbound.patcher.after(parent, method, function(ctx) {
                    return callback(ctx.args, ctx.result);
                }, {
                    caller: STORE_NAME
                });
            },
            reply: reply
        });
        outgoing.start();
        controller.start();
        // Prove the send patch actually took. A lazy proxy silently swallows
        // Object.defineProperty, so "no error" is not evidence of success.
        if (!outgoing.isActive()) {
            warn('Translator: could not hook sending. Nothing will translate.');
            console.warn('[Realtime Translator] sendMessage patch did not apply.' + ' Outgoing translation and !tr are both inactive.');
        }
        // Slash commands are a convenience: Discord's command registry does not
        // resolve on every build, and the patcher throws when the target is not a
        // function. Never let that take translation down with it.
        try {
            commands.start();
        } catch (error) {
            commands = undefined;
            console.warn('[Realtime Translator] Slash commands unavailable; use !tr instead.', error);
        }
    },
    stop: function stop() {
        controller === null || controller === void 0 ? void 0 : controller.stop();
        outgoing === null || outgoing === void 0 ? void 0 : outgoing.stop();
        commands === null || commands === void 0 ? void 0 : commands.stop();
        render === null || render === void 0 ? void 0 : render.stop();
        controller = undefined;
        outgoing = undefined;
        commands = undefined;
        render = undefined;
    },
    getSettingsPanel: function getSettingsPanel() {
        return buildSettingsPanel();
    }
};
return index;
})()