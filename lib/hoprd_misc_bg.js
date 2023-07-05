import { read_file, coerce_version, satisfies } from '@hoprnet/hopr-real';

let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


function isLikeNone(x) {
    return x === undefined || x === null;
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
    if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
        cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64Memory0;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length) >>> 0;
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len) >>> 0;

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3) >>> 0;
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

const CLOSURE_DTORS = new FinalizationRegistry(state => {
    wasm.__wbindgen_export_3.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_3.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state)
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}
function __wbg_adapter_42(arg0, arg1, arg2) {
    wasm.closure565_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_45(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__haeef42ce0f2a8d3f(arg0, arg1);
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}
/**
* Parse a hex string private key to a boxed u8 slice
* @param {string} s
* @returns {Uint8Array}
*/
export function parse_private_key(s) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(s, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.parse_private_key(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
    return instance.ptr;
}

let cachedFloat32Memory0 = null;

function getFloat32Memory0() {
    if (cachedFloat32Memory0 === null || cachedFloat32Memory0.byteLength === 0) {
        cachedFloat32Memory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32Memory0;
}
/**
* @param {any} cli_args
* @returns {HoprdConfig}
*/
export function fetch_configuration(cli_args) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.fetch_configuration(retptr, cli_args);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return HoprdConfig.__wrap(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
*/
export function hoprd_misc_initialize_crate() {
    wasm.hoprd_misc_initialize_crate();
}

let cachedUint32Memory0 = null;

function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
        cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4) >>> 0;
    const mem = getUint32Memory0();
    for (let i = 0; i < array.length; i++) {
        mem[ptr / 4 + i] = addToExternrefTable0(array[i]);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}
/**
* @param {(string)[]} cli_args
* @param {any} envs
* @param {string} mono_repo_path
* @param {string} home_path
* @returns {any}
*/
export function parse_cli_arguments(cli_args, envs, mono_repo_path, home_path) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayJsValueToWasm0(cli_args, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(mono_repo_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(home_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        wasm.parse_cli_arguments(retptr, ptr0, len0, envs, ptr1, len1, ptr2, len2);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return takeFromExternrefTable0(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getUint32Memory0();
    const slice = mem.subarray(ptr / 4, ptr / 4 + len);
    const result = [];
    for (let i = 0; i < slice.length; i++) {
        result.push(wasm.__wbindgen_export_2.get(slice[i]));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}
/**
*/
export function core_strategy_initialize_crate() {
    wasm.core_strategy_initialize_crate();
}

let cachedBigInt64Memory0 = null;

function getBigInt64Memory0() {
    if (cachedBigInt64Memory0 === null || cachedBigInt64Memory0.byteLength === 0) {
        cachedBigInt64Memory0 = new BigInt64Array(wasm.memory.buffer);
    }
    return cachedBigInt64Memory0;
}
/**
* @param {Address} source
* @param {Address} destination
* @returns {Hash}
*/
export function generate_channel_id(source, destination) {
    _assertClass(source, Address);
    _assertClass(destination, Address);
    const ret = wasm.generate_channel_id(source.__wbg_ptr, destination.__wbg_ptr);
    return Hash.__wrap(ret);
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1) >>> 0;
    getUint8Memory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
*/
export function core_types_initialize_crate() {
    wasm.core_types_initialize_crate();
}

/**
* Used in Proof of Relay to derive own half-key (S0)
* The function samples a secp256k1 field element using the given `secret` via `sample_field_element`.
* @param {Uint8Array} secret
* @returns {HalfKey}
*/
export function derive_own_key_share(secret) {
    const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_own_key_share(ptr0, len0);
    return HalfKey.__wrap(ret);
}

/**
* Used in Proof of Relay to derive the half-key of for the acknowledgement (S1)
* The function samples a secp256k1 field element using the given `secret` via `sample_field_element`.
* @param {Uint8Array} secret
* @returns {HalfKey}
*/
export function derive_ack_key_share(secret) {
    const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.derive_ack_key_share(ptr0, len0);
    return HalfKey.__wrap(ret);
}

/**
* @param {Uint8Array} secret
* @returns {Uint8Array}
*/
export function derive_packet_tag(secret) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.derive_packet_tag(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {Uint8Array} private_key
* @param {Uint8Array} channel_info
* @returns {Uint8Array}
*/
export function derive_commitment_seed(private_key, channel_info) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(channel_info, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.derive_commitment_seed(retptr, ptr0, len0, ptr1, len1);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {Uint8Array} secret
* @returns {Uint8Array}
*/
export function derive_mac_key(secret) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.derive_mac_key(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v2 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @returns {number}
*/
export function random_float() {
    const ret = wasm.random_float();
    return ret;
}

/**
* @param {bigint} bound
* @returns {bigint}
*/
export function random_bounded_integer(bound) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.random_bounded_integer(retptr, bound);
        var r0 = getBigInt64Memory0()[retptr / 8 + 0];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        return BigInt.asUintN(64, r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {bigint} start
* @param {bigint | undefined} end
* @returns {bigint}
*/
export function random_big_integer(start, end) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.random_big_integer(retptr, start, !isLikeNone(end), isLikeNone(end) ? BigInt(0) : end);
        var r0 = getBigInt64Memory0()[retptr / 8 + 0];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        return BigInt.asUintN(64, r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {number} start
* @param {number | undefined} end
* @returns {number}
*/
export function random_integer(start, end) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.random_integer(retptr, start, !isLikeNone(end), isLikeNone(end) ? 0 : end);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return r0 >>> 0;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {Uint8Array} buffer
* @param {number} from
* @param {number} len
*/
export function random_fill(buffer, from, len) {
    wasm.random_fill(buffer, from, len);
}

/**
* @param {Uint8Array} seed
* @param {number} iterations
* @param {number} step_size
* @returns {IteratedHash}
*/
export function iterate_hash(seed, iterations, step_size) {
    const ptr0 = passArray8ToWasm0(seed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.iterate_hash(ptr0, len0, iterations, step_size);
    return IteratedHash.__wrap(ret);
}

/**
* @param {Uint8Array} hash_value
* @param {Function} hints
* @param {number} max_iterations
* @param {number} step_size
* @param {number | undefined} index_hint
* @returns {Promise<Intermediate>}
*/
export function recover_iterated_hash(hash_value, hints, max_iterations, step_size, index_hint) {
    const ptr0 = passArray8ToWasm0(hash_value, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.recover_iterated_hash(ptr0, len0, hints, max_iterations, step_size, !isLikeNone(index_hint), isLikeNone(index_hint) ? 0 : index_hint);
    return ret;
}

/**
* @param {Uint8Array} key
* @param {Uint8Array} data
* @returns {Uint8Array}
*/
export function calculate_mac(key, data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.calculate_mac(retptr, ptr0, len0, ptr1, len1);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {Uint8Array} secret
* @param {Uint8Array} data
* @returns {Uint8Array}
*/
export function create_tagged_mac(secret, data) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.create_tagged_mac(retptr, ptr0, len0, ptr1, len1);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        if (r3) {
            throw takeFromExternrefTable0(r2);
        }
        var v3 = getArrayU8FromWasm0(r0, r1).slice();
        wasm.__wbindgen_free(r0, r1 * 1);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
*/
export function core_crypto_initialize_crate() {
    wasm.core_crypto_initialize_crate();
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}
/**
*/
export function core_misc_initialize_crate() {
    wasm.core_misc_initialize_crate();
}

/**
* Returns a struct with readonly constants, needs to be a function
* because Rust does not support exporting constants to WASM
* @returns {CoreConstants}
*/
export function CORE_CONSTANTS() {
    const ret = wasm.CORE_CONSTANTS();
    return CoreConstants.__wrap(ret);
}

/**
*/
export function utils_misc_initialize_crate() {
    wasm.utils_misc_initialize_crate();
}

function __wbg_adapter_671(arg0, arg1, arg2, arg3) {
    wasm.closure580_externref_shim(arg0, arg1, arg2, arg3);
}

/**
*/
export function core_ethereum_db_initialize_crate() {
    wasm.core_ethereum_db_initialize_crate();
}

function notDefined(what) { return () => { throw new Error(`${what} is not defined`); }; }
/**
*/
export function core_network_initialize_crate() {
    wasm.core_network_initialize_crate();
}

/**
* @param {any} db
* @returns {Promise<boolean>}
*/
export function db_sanity_test(db) {
    const ret = wasm.db_sanity_test(db);
    return ret;
}

/**
* @param {string} mono_repo_path
* @returns {any}
*/
export function supported_networks(mono_repo_path) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(mono_repo_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.supported_networks(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return takeFromExternrefTable0(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {string} mono_repo_path
* @param {string} id
* @param {string | undefined} maybe_custom_provider
* @returns {any}
*/
export function resolve_network(mono_repo_path, id, maybe_custom_provider) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(mono_repo_path, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        var ptr2 = isLikeNone(maybe_custom_provider) ? 0 : passStringToWasm0(maybe_custom_provider, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len2 = WASM_VECTOR_LEN;
        wasm.resolve_network(retptr, ptr0, len0, ptr1, len1, ptr2, len2);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        if (r2) {
            throw takeFromExternrefTable0(r1);
        }
        return takeFromExternrefTable0(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
* @param {number} status
* @returns {number}
*/
export function channel_status_to_number(status) {
    const ret = wasm.channel_status_to_number(status);
    return ret;
}

/**
* @param {number} number
* @returns {number | undefined}
*/
export function number_to_channel_status(number) {
    const ret = wasm.number_to_channel_status(number);
    return ret === 4 ? undefined : ret;
}

/**
* @param {number} status
* @returns {string}
*/
export function channel_status_to_string(status) {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.channel_status_to_string(retptr, status);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(deferred1_0, deferred1_1);
    }
}

/**
* @param {Hash} message
* @returns {Hash}
*/
export function ethereum_signed_hash(message) {
    _assertClass(message, Hash);
    const ret = wasm.ethereum_signed_hash(message.__wbg_ptr);
    return Hash.__wrap(ret);
}

/**
* Dummy function to test WASM.
* @returns {string}
*/
export function dummy_get_one() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.dummy_get_one(retptr);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(deferred1_0, deferred1_1);
    }
}

/**
* Reads the given package.json file and determines its version.
* @param {string} package_file
* @returns {string}
*/
export function get_package_version(package_file) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(package_file, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.get_package_version(retptr, ptr0, len0);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        var r2 = getInt32Memory0()[retptr / 4 + 2];
        var r3 = getInt32Memory0()[retptr / 4 + 3];
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(deferred3_0, deferred3_1);
    }
}

/**
* Returns a struct with readonly constants, needs to be a function
* because Rust does not support exporting constants to WASM
* @returns {CoreEthereumConstants}
*/
export function CORE_ETHEREUM_CONSTANTS() {
    const ret = wasm.CORE_ETHEREUM_CONSTANTS();
    return CoreEthereumConstants.__wrap(ret);
}

/**
*/
export function utils_types_initialize_crate() {
    wasm.utils_types_initialize_crate();
}

/**
*/
export function utils_log_initialize_crate() {
    wasm.utils_log_initialize_crate();
}

/**
*/
export function core_ethereum_misc_initialize_crate() {
    wasm.core_ethereum_misc_initialize_crate();
}

/**
* Describes status of a channel
*/
export const ChannelStatus = Object.freeze({ Closed:0,"0":"Closed",WaitingForCommitment:1,"1":"WaitingForCommitment",Open:2,"2":"Open",PendingToClose:3,"3":"PendingToClose", });
/**
* Represents a type of the balance: native or HOPR tokens.
*/
export const BalanceType = Object.freeze({ Native:0,"0":"Native",HOPR:1,"1":"HOPR", });
/**
*/
export const EnvironmentType = Object.freeze({ Production:0,"0":"Production",Staging:1,"1":"Staging",Development:2,"2":"Development",Local:3,"3":"Local", });

const AccountEntryFinalization = new FinalizationRegistry(ptr => wasm.__wbg_accountentry_free(ptr >>> 0));
/**
* Represents a node announcement entry on the block chain.
* This contains node's public key and optional announcement information (multiaddress, block number).
*/
export class AccountEntry {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AccountEntry.prototype);
        obj.__wbg_ptr = ptr;
        AccountEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AccountEntryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_accountentry_free(ptr);
    }
    /**
    * @returns {PublicKey}
    */
    get public_key() {
        const ret = wasm.__wbg_get_accountentry_public_key(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set public_key(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_accountentry_public_key(this.__wbg_ptr, ptr0);
    }
    /**
    * Gets public key as an address
    * @returns {Address}
    */
    get_address() {
        const ret = wasm.accountentry_get_address(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * Gets public key as a PeerId string
    * @returns {string}
    */
    get_peer_id_str() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.accountentry_get_peer_id_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * Gets multiaddress as string if this peer ID has been announced.
    * @returns {string | undefined}
    */
    get_multiaddress_str() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.accountentry_get_multiaddress_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Gets the block number of the announcement if this peer ID has been announced.
    * @returns {number | undefined}
    */
    updated_at() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.accountentry_updated_at(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Is the node announced?
    * @returns {boolean}
    */
    has_announced() {
        const ret = wasm.accountentry_has_announced(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * If the node has announced, did it announce with routing information ?
    * @returns {boolean}
    */
    contains_routing_info() {
        const ret = wasm.accountentry_contains_routing_info(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {PublicKey} public_key
    * @param {string | undefined} multiaddr
    * @param {number | undefined} updated_at
    */
    constructor(public_key, multiaddr, updated_at) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(public_key, PublicKey);
            var ptr0 = public_key.__destroy_into_raw();
            var ptr1 = isLikeNone(multiaddr) ? 0 : passStringToWasm0(multiaddr, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            wasm.accountentry__new(retptr, ptr0, ptr1, len1, !isLikeNone(updated_at), isLikeNone(updated_at) ? 0 : updated_at);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return AccountEntry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.accountentry_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} data
    * @returns {AccountEntry}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.accountentry_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return AccountEntry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {AccountEntry}
    */
    clone() {
        const ret = wasm.accountentry_clone(this.__wbg_ptr);
        return AccountEntry.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.accountentry_size();
        return ret >>> 0;
    }
}

const AcknowledgedTicketFinalization = new FinalizationRegistry(ptr => wasm.__wbg_acknowledgedticket_free(ptr >>> 0));
/**
* Contains acknowledgment information and the respective ticket
*/
export class AcknowledgedTicket {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AcknowledgedTicket.prototype);
        obj.__wbg_ptr = ptr;
        AcknowledgedTicketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AcknowledgedTicketFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_acknowledgedticket_free(ptr);
    }
    /**
    * @returns {Ticket}
    */
    get ticket() {
        const ret = wasm.__wbg_get_acknowledgedticket_ticket(this.__wbg_ptr);
        return Ticket.__wrap(ret);
    }
    /**
    * @param {Ticket} arg0
    */
    set ticket(arg0) {
        _assertClass(arg0, Ticket);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgedticket_ticket(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Response}
    */
    get response() {
        const ret = wasm.__wbg_get_acknowledgedticket_response(this.__wbg_ptr);
        return Response.__wrap(ret);
    }
    /**
    * @param {Response} arg0
    */
    set response(arg0) {
        _assertClass(arg0, Response);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgedticket_response(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Hash}
    */
    get pre_image() {
        const ret = wasm.__wbg_get_acknowledgedticket_pre_image(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * @param {Hash} arg0
    */
    set pre_image(arg0) {
        _assertClass(arg0, Hash);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgedticket_pre_image(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {PublicKey}
    */
    get signer() {
        const ret = wasm.__wbg_get_acknowledgedticket_signer(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set signer(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgedticket_signer(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {Ticket} ticket
    * @param {Response} response
    * @param {Hash} pre_image
    * @param {PublicKey} signer
    */
    constructor(ticket, response, pre_image, signer) {
        _assertClass(ticket, Ticket);
        var ptr0 = ticket.__destroy_into_raw();
        _assertClass(response, Response);
        var ptr1 = response.__destroy_into_raw();
        _assertClass(pre_image, Hash);
        var ptr2 = pre_image.__destroy_into_raw();
        _assertClass(signer, PublicKey);
        var ptr3 = signer.__destroy_into_raw();
        const ret = wasm.acknowledgedticket_new(ptr0, ptr1, ptr2, ptr3);
        return AcknowledgedTicket.__wrap(ret);
    }
    /**
    * @param {Hash} hash
    */
    set_preimage(hash) {
        _assertClass(hash, Hash);
        wasm.acknowledgedticket_set_preimage(this.__wbg_ptr, hash.__wbg_ptr);
    }
    /**
    * @param {Uint8Array} data
    * @returns {AcknowledgedTicket}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.acknowledgedticket_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return AcknowledgedTicket.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.acknowledgedticket_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {AcknowledgedTicket} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, AcknowledgedTicket);
        const ret = wasm.acknowledgedticket_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {PublicKey} issuer
    * @returns {boolean}
    */
    verify(issuer) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(issuer, PublicKey);
            wasm.acknowledgedticket_verify(retptr, this.__wbg_ptr, issuer.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {AcknowledgedTicket}
    */
    clone() {
        const ret = wasm.acknowledgedticket_clone(this.__wbg_ptr);
        return AcknowledgedTicket.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.acknowledgedticket_size();
        return ret >>> 0;
    }
}

const AcknowledgementFinalization = new FinalizationRegistry(ptr => wasm.__wbg_acknowledgement_free(ptr >>> 0));
/**
* Represents packet acknowledgement
*/
export class Acknowledgement {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Acknowledgement.prototype);
        obj.__wbg_ptr = ptr;
        AcknowledgementFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AcknowledgementFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_acknowledgement_free(ptr);
    }
    /**
    * @returns {HalfKey}
    */
    get ack_key_share() {
        const ret = wasm.__wbg_get_acknowledgement_ack_key_share(this.__wbg_ptr);
        return HalfKey.__wrap(ret);
    }
    /**
    * @param {HalfKey} arg0
    */
    set ack_key_share(arg0) {
        _assertClass(arg0, HalfKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgement_ack_key_share(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {AcknowledgementChallenge} ack_challenge
    * @param {HalfKey} ack_key_share
    * @param {Uint8Array} private_key
    */
    constructor(ack_challenge, ack_key_share, private_key) {
        _assertClass(ack_challenge, AcknowledgementChallenge);
        var ptr0 = ack_challenge.__destroy_into_raw();
        _assertClass(ack_key_share, HalfKey);
        var ptr1 = ack_key_share.__destroy_into_raw();
        const ptr2 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.acknowledgement_new(ptr0, ptr1, ptr2, len2);
        return Acknowledgement.__wrap(ret);
    }
    /**
    * Validates the acknowledgement. Must be called immediately after deserialization or otherwise
    * any operations with the deserialized acknowledgment will panic.
    * @param {PublicKey} own_public_key
    * @param {PublicKey} sender_public_key
    * @returns {boolean}
    */
    validate(own_public_key, sender_public_key) {
        _assertClass(own_public_key, PublicKey);
        _assertClass(sender_public_key, PublicKey);
        const ret = wasm.acknowledgement_validate(this.__wbg_ptr, own_public_key.__wbg_ptr, sender_public_key.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * Obtains the acknowledged challenge out of this acknowledgment.
    * @returns {HalfKeyChallenge}
    */
    ack_challenge() {
        const ret = wasm.acknowledgement_ack_challenge(this.__wbg_ptr);
        return HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {Acknowledgement}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.acknowledgement_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Acknowledgement.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.acknowledgement_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Acknowledgement} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, Acknowledgement);
        const ret = wasm.acknowledgement_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {Acknowledgement}
    */
    clone() {
        const ret = wasm.acknowledgement_clone(this.__wbg_ptr);
        return Acknowledgement.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.acknowledgement_size();
        return ret >>> 0;
    }
}

const AcknowledgementChallengeFinalization = new FinalizationRegistry(ptr => wasm.__wbg_acknowledgementchallenge_free(ptr >>> 0));
/**
* Contains cryptographic challenge that needs to be solved for acknowledging a packet.
*/
export class AcknowledgementChallenge {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AcknowledgementChallenge.prototype);
        obj.__wbg_ptr = ptr;
        AcknowledgementChallengeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AcknowledgementChallengeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_acknowledgementchallenge_free(ptr);
    }
    /**
    * @returns {HalfKeyChallenge | undefined}
    */
    get ack_challenge() {
        const ret = wasm.__wbg_get_acknowledgementchallenge_ack_challenge(this.__wbg_ptr);
        return ret === 0 ? undefined : HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @param {HalfKeyChallenge | undefined} arg0
    */
    set ack_challenge(arg0) {
        let ptr0 = 0;
        if (!isLikeNone(arg0)) {
            _assertClass(arg0, HalfKeyChallenge);
            ptr0 = arg0.__destroy_into_raw();
        }
        wasm.__wbg_set_acknowledgementchallenge_ack_challenge(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Signature}
    */
    get signature() {
        const ret = wasm.__wbg_get_acknowledgementchallenge_signature(this.__wbg_ptr);
        return Signature.__wrap(ret);
    }
    /**
    * @param {Signature} arg0
    */
    set signature(arg0) {
        _assertClass(arg0, Signature);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_acknowledgementchallenge_signature(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {HalfKeyChallenge} ack_challenge
    * @param {Uint8Array} private_key
    */
    constructor(ack_challenge, private_key) {
        _assertClass(ack_challenge, HalfKeyChallenge);
        const ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.acknowledgementchallenge_new(ack_challenge.__wbg_ptr, ptr0, len0);
        return AcknowledgementChallenge.__wrap(ret);
    }
    /**
    * Checks if the given secret solves this challenge.
    * @param {Uint8Array} secret
    * @returns {boolean}
    */
    solve(secret) {
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.acknowledgementchallenge_solve(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
    * @param {PublicKey} public_key
    * @param {Signature} signature
    * @param {HalfKeyChallenge} challenge
    * @returns {boolean}
    */
    static verify(public_key, signature, challenge) {
        _assertClass(public_key, PublicKey);
        _assertClass(signature, Signature);
        _assertClass(challenge, HalfKeyChallenge);
        const ret = wasm.acknowledgementchallenge_verify(public_key.__wbg_ptr, signature.__wbg_ptr, challenge.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {HalfKeyChallenge} ack_challenge
    * @param {PublicKey} public_key
    * @returns {boolean}
    */
    validate(ack_challenge, public_key) {
        _assertClass(ack_challenge, HalfKeyChallenge);
        var ptr0 = ack_challenge.__destroy_into_raw();
        _assertClass(public_key, PublicKey);
        const ret = wasm.acknowledgementchallenge_validate(this.__wbg_ptr, ptr0, public_key.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {Uint8Array} data
    * @returns {AcknowledgementChallenge}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.acknowledgementchallenge_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return AcknowledgementChallenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.acknowledgementchallenge_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {AcknowledgementChallenge} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, AcknowledgementChallenge);
        const ret = wasm.acknowledgementchallenge_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {AcknowledgementChallenge}
    */
    clone() {
        const ret = wasm.acknowledgementchallenge_clone(this.__wbg_ptr);
        return AcknowledgementChallenge.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.acknowledgementchallenge_size();
        return ret >>> 0;
    }
}

const AddressFinalization = new FinalizationRegistry(ptr => wasm.__wbg_address_free(ptr >>> 0));
/**
* Represents an Ethereum address
*/
export class Address {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Address.prototype);
        obj.__wbg_ptr = ptr;
        AddressFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AddressFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_address_free(ptr);
    }
    /**
    * @param {Uint8Array} bytes
    */
    constructor(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.address_new(ptr0, len0);
        return Address.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    to_bytes32() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.address_to_bytes32(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_string() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.address_to_string(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} str
    * @returns {Address}
    */
    static from_string(str) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.address_from_string(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Address.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} data
    * @returns {Address}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.address_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Address.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.address_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.address_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Address} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, Address);
        const ret = wasm.address_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {Address}
    */
    clone() {
        const ret = wasm.address_clone(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.address_size();
        return ret >>> 0;
    }
}

const ApiFinalization = new FinalizationRegistry(ptr => wasm.__wbg_api_free(ptr >>> 0));
/**
*/
export class Api {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Api.prototype);
        obj.__wbg_ptr = ptr;
        ApiFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ApiFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_api_free(ptr);
    }
    /**
    * @returns {boolean}
    */
    get enable() {
        const ret = wasm.__wbg_get_api_enable(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set enable(arg0) {
        wasm.__wbg_set_api_enable(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {Host}
    */
    get host() {
        const ret = wasm.__wbg_get_api_host(this.__wbg_ptr);
        return Host.__wrap(ret);
    }
    /**
    * @param {Host} arg0
    */
    set host(arg0) {
        _assertClass(arg0, Host);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_api_host(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {boolean}
    */
    is_auth_disabled() {
        const ret = wasm.api_is_auth_disabled(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {string | undefined}
    */
    auth_token() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.api_auth_token(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const AsyncIterableHelperFinalization = new FinalizationRegistry(ptr => wasm.__wbg_asynciterablehelper_free(ptr >>> 0));
/**
* Helper struct to export Rust Streams into Javascript AsyncIterables
*
* ```
* use futures::stream::{Stream, StreamExt};
* use wasm_bindgen::prelude::*;
* use wasm_bindgen_futures::stream::JsStream;
* use js_sys::AsyncIterator;
* use utils_misc::async_iterable::wasm::to_box_u8_stream;
*
* #[wasm_bindgen]
* pub struct AsyncIterableHelper {
*    stream: Box<dyn Stream<Item = Result<Box<[u8]>, String>> + Unpin>, // must not be pub
* }
* #[wasm_bindgen]
* pub fn async_test(some_async_iterable: AsyncIterator) -> Result<AsyncIterableHelper, JsValue> {
*     let stream = JsStream::from(some_async_iterable);
*
*     let stream = stream.map(to_box_u8_stream);
*
*     Ok(AsyncIterableHelper {
*         stream: Box::new(stream),
*     })
* }
* ```
*/
export class AsyncIterableHelper {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AsyncIterableHelperFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_asynciterablehelper_free(ptr);
    }
    /**
    * @returns {Promise<any>}
    */
    next() {
        const ret = wasm.asynciterablehelper_next(this.__wbg_ptr);
        return ret;
    }
}

const BalanceFinalization = new FinalizationRegistry(ptr => wasm.__wbg_balance_free(ptr >>> 0));
/**
* Represents balance of some coin or token.
*/
export class Balance {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Balance.prototype);
        obj.__wbg_ptr = ptr;
        BalanceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BalanceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_balance_free(ptr);
    }
    /**
    * Creates new balance of the given type from the base 10 integer string
    * @param {string} value
    * @param {number} balance_type
    */
    constructor(value, balance_type) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.balance_from_str(ptr0, len0, balance_type);
        return Balance.__wrap(ret);
    }
    /**
    * Creates zero balance of the given type
    * @param {number} balance_type
    * @returns {Balance}
    */
    static zero(balance_type) {
        const ret = wasm.balance_zero(balance_type);
        return Balance.__wrap(ret);
    }
    /**
    * Retrieves the type (symbol) of the balance
    * @returns {number}
    */
    balance_type() {
        const ret = wasm.balance_balance_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * Creates balance of the given value with the same symbol
    * @param {string} value
    * @returns {Balance}
    */
    of_same(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.balance_of_same(this.__wbg_ptr, ptr0, len0);
        return Balance.__wrap(ret);
    }
    /**
    * Serializes just the value of the balance (not the symbol)
    * @returns {Uint8Array}
    */
    serialize_value() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.balance_serialize_value(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Balance} other
    * @returns {boolean}
    */
    lt(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_lt(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {Balance} other
    * @returns {boolean}
    */
    lte(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_lte(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {Balance} other
    * @returns {boolean}
    */
    gt(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_gt(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {Balance} other
    * @returns {boolean}
    */
    gte(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_gte(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {Balance} other
    * @returns {Balance}
    */
    add(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_add(this.__wbg_ptr, other.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @param {bigint} amount
    * @returns {Balance}
    */
    iadd(amount) {
        const ret = wasm.balance_iadd(this.__wbg_ptr, amount);
        return Balance.__wrap(ret);
    }
    /**
    * @param {Balance} other
    * @returns {Balance}
    */
    sub(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_sub(this.__wbg_ptr, other.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @param {bigint} amount
    * @returns {Balance}
    */
    isub(amount) {
        const ret = wasm.balance_isub(this.__wbg_ptr, amount);
        return Balance.__wrap(ret);
    }
    /**
    * @param {Balance} other
    * @returns {Balance}
    */
    mul(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_mul(this.__wbg_ptr, other.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @param {bigint} amount
    * @returns {Balance}
    */
    imul(amount) {
        const ret = wasm.balance_imul(this.__wbg_ptr, amount);
        return Balance.__wrap(ret);
    }
    /**
    * @returns {U256}
    */
    amount() {
        const ret = wasm.__wbg_get_snapshot_block_number(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @param {number} balance_type
    * @returns {Balance}
    */
    static deserialize(data, balance_type) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.balance_deserialize(retptr, ptr0, len0, balance_type);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Balance.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_formatted_string() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.balance_to_formatted_string(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Balance} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, Balance);
        const ret = wasm.balance_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {Balance}
    */
    clone() {
        const ret = wasm.balance_clone(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    to_string() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.balance_to_string(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.balance_size();
        return ret >>> 0;
    }
}

const ChainFinalization = new FinalizationRegistry(ptr => wasm.__wbg_chain_free(ptr >>> 0));
/**
*/
export class Chain {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Chain.prototype);
        obj.__wbg_ptr = ptr;
        ChainFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChainFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chain_free(ptr);
    }
    /**
    * @returns {string | undefined}
    */
    get provider() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chain_provider(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set provider(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chain_provider(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {boolean}
    */
    get check_unrealized_balance() {
        const ret = wasm.__wbg_get_chain_check_unrealized_balance(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set check_unrealized_balance(arg0) {
        wasm.__wbg_set_chain_check_unrealized_balance(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {number}
    */
    get on_chain_confirmations() {
        const ret = wasm.__wbg_get_chain_on_chain_confirmations(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set on_chain_confirmations(arg0) {
        wasm.__wbg_set_chain_on_chain_confirmations(this.__wbg_ptr, arg0);
    }
}

const ChainOptionsFinalization = new FinalizationRegistry(ptr => wasm.__wbg_chainoptions_free(ptr >>> 0));
/**
* Holds all information we need about the blockchain network
* the client is going to use
*/
export class ChainOptions {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ChainOptions.prototype);
        obj.__wbg_ptr = ptr;
        ChainOptionsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChainOptionsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chainoptions_free(ptr);
    }
    /**
    * @returns {string}
    */
    get id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_id(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set id(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_id(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get description() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_description(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set description(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_description(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * >= 0
    * @returns {number}
    */
    get chain_id() {
        const ret = wasm.__wbg_get_chainoptions_chain_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * >= 0
    * @param {number} arg0
    */
    set chain_id(arg0) {
        wasm.__wbg_set_chainoptions_chain_id(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get live() {
        const ret = wasm.__wbg_get_chainoptions_live(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set live(arg0) {
        wasm.__wbg_set_chainoptions_live(this.__wbg_ptr, arg0);
    }
    /**
    * a valid HTTP url pointing at a RPC endpoint
    * @returns {string}
    */
    get default_provider() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_default_provider(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * a valid HTTP url pointing at a RPC endpoint
    * @param {string} arg0
    */
    set default_provider(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_default_provider(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * a valid HTTP url pointing at a RPC endpoint
    * @returns {string | undefined}
    */
    get etherscan_api_url() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_etherscan_api_url(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * a valid HTTP url pointing at a RPC endpoint
    * @param {string | undefined} arg0
    */
    set etherscan_api_url(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_etherscan_api_url(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * The absolute maximum you are willing to pay per unit of gas to get your transaction included in a block, e.g. '10 gwei'
    * @returns {string}
    */
    get max_fee_per_gas() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_max_fee_per_gas(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * The absolute maximum you are willing to pay per unit of gas to get your transaction included in a block, e.g. '10 gwei'
    * @param {string} arg0
    */
    set max_fee_per_gas(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_max_fee_per_gas(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * Tips paid directly to miners, e.g. '2 gwei'
    * @returns {string}
    */
    get max_priority_fee_per_gas() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_max_priority_fee_per_gas(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * Tips paid directly to miners, e.g. '2 gwei'
    * @param {string} arg0
    */
    set max_priority_fee_per_gas(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_max_priority_fee_per_gas(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get native_token_name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_native_token_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set native_token_name(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_native_token_name(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get hopr_token_name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_hopr_token_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set hopr_token_name(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_hopr_token_name(this.__wbg_ptr, ptr0, len0);
    }
}

const ChallengeFinalization = new FinalizationRegistry(ptr => wasm.__wbg_challenge_free(ptr >>> 0));
/**
* Natural extension of the Curve Point to the Proof-of-Relay challenge.
* Proof-of-Relay challenge is a secp256k1 curve point.
*/
export class Challenge {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Challenge.prototype);
        obj.__wbg_ptr = ptr;
        ChallengeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChallengeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_challenge_free(ptr);
    }
    /**
    * @returns {CurvePoint}
    */
    get curve_point() {
        const ret = wasm.__wbg_get_challenge_curve_point(this.__wbg_ptr);
        return CurvePoint.__wrap(ret);
    }
    /**
    * @param {CurvePoint} arg0
    */
    set curve_point(arg0) {
        _assertClass(arg0, CurvePoint);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_challenge_curve_point(this.__wbg_ptr, ptr0);
    }
    /**
    * Converts the PoR challenge to an Ethereum challenge.
    * This is a one-way (lossy) operation, since the corresponding curve point is hashed
    * with the hash value then truncated.
    * @returns {EthereumChallenge}
    */
    to_ethereum_challenge() {
        const ret = wasm.challenge_to_ethereum_challenge(this.__wbg_ptr);
        return EthereumChallenge.__wrap(ret);
    }
    /**
    * @param {HalfKeyChallenge} own_share
    * @param {HalfKeyChallenge} hint
    * @returns {Challenge}
    */
    static from_hint_and_share(own_share, hint) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(own_share, HalfKeyChallenge);
            _assertClass(hint, HalfKeyChallenge);
            wasm.challenge_from_hint_and_share(retptr, own_share.__wbg_ptr, hint.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Challenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {HalfKeyChallenge} own_share
    * @param {HalfKey} half_key
    * @returns {Challenge}
    */
    static from_own_share_and_half_key(own_share, half_key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(own_share, HalfKeyChallenge);
            _assertClass(half_key, HalfKey);
            wasm.challenge_from_own_share_and_half_key(retptr, own_share.__wbg_ptr, half_key.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Challenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} data
    * @returns {Challenge}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.challenge_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Challenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.challenge_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.challenge_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Challenge}
    */
    clone() {
        const ret = wasm.challenge_clone(this.__wbg_ptr);
        return Challenge.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.challenge_size();
        return ret >>> 0;
    }
}

const ChannelEntryFinalization = new FinalizationRegistry(ptr => wasm.__wbg_channelentry_free(ptr >>> 0));
/**
* Overall description of a channel
*/
export class ChannelEntry {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ChannelEntry.prototype);
        obj.__wbg_ptr = ptr;
        ChannelEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChannelEntryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_channelentry_free(ptr);
    }
    /**
    * @returns {PublicKey}
    */
    get source() {
        const ret = wasm.__wbg_get_channelentry_source(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set source(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_source(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {PublicKey}
    */
    get destination() {
        const ret = wasm.__wbg_get_channelentry_destination(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set destination(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_destination(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Balance}
    */
    get balance() {
        const ret = wasm.__wbg_get_channelentry_balance(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @param {Balance} arg0
    */
    set balance(arg0) {
        _assertClass(arg0, Balance);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_balance(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Hash}
    */
    get commitment() {
        const ret = wasm.__wbg_get_channelentry_commitment(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * @param {Hash} arg0
    */
    set commitment(arg0) {
        _assertClass(arg0, Hash);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_commitment(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get ticket_epoch() {
        const ret = wasm.__wbg_get_channelentry_ticket_epoch(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set ticket_epoch(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_ticket_epoch(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get ticket_index() {
        const ret = wasm.__wbg_get_channelentry_ticket_index(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set ticket_index(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_ticket_index(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {number}
    */
    get status() {
        const ret = wasm.__wbg_get_channelentry_status(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set status(arg0) {
        wasm.__wbg_set_channelentry_status(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {U256}
    */
    get channel_epoch() {
        const ret = wasm.__wbg_get_channelentry_channel_epoch(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set channel_epoch(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_channel_epoch(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get closure_time() {
        const ret = wasm.__wbg_get_channelentry_closure_time(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set closure_time(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_closure_time(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {PublicKey} source
    * @param {PublicKey} destination
    * @param {Balance} balance
    * @param {Hash} commitment
    * @param {U256} ticket_epoch
    * @param {U256} ticket_index
    * @param {number} status
    * @param {U256} channel_epoch
    * @param {U256} closure_time
    */
    constructor(source, destination, balance, commitment, ticket_epoch, ticket_index, status, channel_epoch, closure_time) {
        _assertClass(source, PublicKey);
        var ptr0 = source.__destroy_into_raw();
        _assertClass(destination, PublicKey);
        var ptr1 = destination.__destroy_into_raw();
        _assertClass(balance, Balance);
        var ptr2 = balance.__destroy_into_raw();
        _assertClass(commitment, Hash);
        var ptr3 = commitment.__destroy_into_raw();
        _assertClass(ticket_epoch, U256);
        var ptr4 = ticket_epoch.__destroy_into_raw();
        _assertClass(ticket_index, U256);
        var ptr5 = ticket_index.__destroy_into_raw();
        _assertClass(channel_epoch, U256);
        var ptr6 = channel_epoch.__destroy_into_raw();
        _assertClass(closure_time, U256);
        var ptr7 = closure_time.__destroy_into_raw();
        const ret = wasm.channelentry_new(ptr0, ptr1, ptr2, ptr3, ptr4, ptr5, status, ptr6, ptr7);
        return ChannelEntry.__wrap(ret);
    }
    /**
    * Generates the ticket ID using the source and destination address
    * @returns {Hash}
    */
    get_id() {
        const ret = wasm.channelentry_get_id(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * Checks if the closure time of this channel has passed.
    * @returns {boolean | undefined}
    */
    closure_time_passed() {
        const ret = wasm.channelentry_closure_time_passed(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * Calculates the remaining channel closure grace period.
    * @returns {bigint | undefined}
    */
    remaining_closure_time() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.channelentry_remaining_closure_time(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r2 = getBigInt64Memory0()[retptr / 8 + 1];
            return r0 === 0 ? undefined : BigInt.asUintN(64, r2);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} data
    * @returns {ChannelEntry}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.channelentry_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return ChannelEntry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.channelentry_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {ChannelEntry} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, ChannelEntry);
        const ret = wasm.channelentry_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {ChannelEntry}
    */
    clone() {
        const ret = wasm.channelentry_clone(this.__wbg_ptr);
        return ChannelEntry.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.channelentry_size();
        return ret >>> 0;
    }
}

const CliArgsFinalization = new FinalizationRegistry(ptr => wasm.__wbg_cliargs_free(ptr >>> 0));
/**
* Takes all CLI arguments whose structure is known at compile-time.
* Arguments whose structure, e.g. their default values depend on
* file contents need be specified using `clap`s builder API
*/
export class CliArgs {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CliArgsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cliargs_free(ptr);
    }
    /**
    * network
    * @returns {string}
    */
    get network() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_network(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * network
    * @param {string} arg0
    */
    set network(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_network(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get identity() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_identity(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set identity(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_identity(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get data() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_data(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set data(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_data(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {Host | undefined}
    */
    get host() {
        const ret = wasm.__wbg_get_cliargs_host(this.__wbg_ptr);
        return ret === 0 ? undefined : Host.__wrap(ret);
    }
    /**
    * @param {Host | undefined} arg0
    */
    set host(arg0) {
        let ptr0 = 0;
        if (!isLikeNone(arg0)) {
            _assertClass(arg0, Host);
            ptr0 = arg0.__destroy_into_raw();
        }
        wasm.__wbg_set_cliargs_host(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get announce() {
        const ret = wasm.__wbg_get_cliargs_announce(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set announce(arg0) {
        wasm.__wbg_set_cliargs_announce(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get api() {
        const ret = wasm.__wbg_get_cliargs_api(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set api(arg0) {
        wasm.__wbg_set_cliargs_api(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {string | undefined}
    */
    get api_host() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_api_host(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set api_host(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_api_host(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number | undefined}
    */
    get api_port() {
        const ret = wasm.__wbg_get_cliargs_api_port(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
    * @param {number | undefined} arg0
    */
    set api_port(arg0) {
        wasm.__wbg_set_cliargs_api_port(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get disable_api_authentication() {
        const ret = wasm.__wbg_get_cliargs_disable_api_authentication(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set disable_api_authentication(arg0) {
        wasm.__wbg_set_cliargs_disable_api_authentication(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {string | undefined}
    */
    get api_token() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_api_token(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set api_token(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_api_token(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get health_check() {
        const ret = wasm.__wbg_get_cliargs_health_check(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set health_check(arg0) {
        wasm.__wbg_set_cliargs_health_check(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {string | undefined}
    */
    get health_check_host() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_health_check_host(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set health_check_host(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_health_check_host(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number | undefined}
    */
    get health_check_port() {
        const ret = wasm.__wbg_get_cliargs_health_check_port(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
    * @param {number | undefined} arg0
    */
    set health_check_port(arg0) {
        wasm.__wbg_set_cliargs_health_check_port(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0);
    }
    /**
    * @returns {string | undefined}
    */
    get password() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_password(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set password(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_password(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string | undefined}
    */
    get default_strategy() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_default_strategy(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set default_strategy(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_default_strategy(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number | undefined}
    */
    get max_auto_channels() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_max_auto_channels(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set max_auto_channels(arg0) {
        wasm.__wbg_set_cliargs_max_auto_channels(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get auto_redeem_tickets() {
        const ret = wasm.__wbg_get_cliargs_auto_redeem_tickets(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set auto_redeem_tickets(arg0) {
        wasm.__wbg_set_cliargs_auto_redeem_tickets(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get check_unrealized_balance() {
        const ret = wasm.__wbg_get_cliargs_check_unrealized_balance(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set check_unrealized_balance(arg0) {
        wasm.__wbg_set_cliargs_check_unrealized_balance(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {string | undefined}
    */
    get provider() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_provider(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set provider(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_provider(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {boolean}
    */
    get dry_run() {
        const ret = wasm.__wbg_get_cliargs_dry_run(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set dry_run(arg0) {
        wasm.__wbg_set_cliargs_dry_run(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get init() {
        const ret = wasm.__wbg_get_cliargs_init(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set init(arg0) {
        wasm.__wbg_set_cliargs_init(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get force_init() {
        const ret = wasm.__wbg_get_cliargs_force_init(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set force_init(arg0) {
        wasm.__wbg_set_cliargs_force_init(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {string | undefined}
    */
    get private_key() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_private_key(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set private_key(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_private_key(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get allow_local_node_connections() {
        const ret = wasm.__wbg_get_cliargs_allow_local_node_connections(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set allow_local_node_connections(arg0) {
        wasm.__wbg_set_cliargs_allow_local_node_connections(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get allow_private_node_connections() {
        const ret = wasm.__wbg_get_cliargs_allow_private_node_connections(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set allow_private_node_connections(arg0) {
        wasm.__wbg_set_cliargs_allow_private_node_connections(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {number | undefined}
    */
    get max_parallel_connections() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_max_parallel_connections(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set max_parallel_connections(arg0) {
        wasm.__wbg_set_cliargs_max_parallel_connections(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_announce_local_addresses() {
        const ret = wasm.__wbg_get_cliargs_test_announce_local_addresses(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_announce_local_addresses(arg0) {
        wasm.__wbg_set_cliargs_test_announce_local_addresses(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_prefer_local_addresses() {
        const ret = wasm.__wbg_get_cliargs_test_prefer_local_addresses(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_prefer_local_addresses(arg0) {
        wasm.__wbg_set_cliargs_test_prefer_local_addresses(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_use_weak_crypto() {
        const ret = wasm.__wbg_get_cliargs_test_use_weak_crypto(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_use_weak_crypto(arg0) {
        wasm.__wbg_set_cliargs_test_use_weak_crypto(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_no_direct_connections() {
        const ret = wasm.__wbg_get_cliargs_test_no_direct_connections(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_no_direct_connections(arg0) {
        wasm.__wbg_set_cliargs_test_no_direct_connections(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_no_webrtc_upgrade() {
        const ret = wasm.__wbg_get_cliargs_test_no_webrtc_upgrade(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_no_webrtc_upgrade(arg0) {
        wasm.__wbg_set_cliargs_test_no_webrtc_upgrade(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get no_relay() {
        const ret = wasm.__wbg_get_cliargs_no_relay(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set no_relay(arg0) {
        wasm.__wbg_set_cliargs_no_relay(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {boolean | undefined}
    */
    get test_local_mode_stun() {
        const ret = wasm.__wbg_get_cliargs_test_local_mode_stun(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
    * @param {boolean | undefined} arg0
    */
    set test_local_mode_stun(arg0) {
        wasm.__wbg_set_cliargs_test_local_mode_stun(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
    * @returns {number | undefined}
    */
    get heartbeat_interval() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_heartbeat_interval(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set heartbeat_interval(arg0) {
        wasm.__wbg_set_cliargs_heartbeat_interval(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {number | undefined}
    */
    get heartbeat_threshold() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_heartbeat_threshold(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set heartbeat_threshold(arg0) {
        wasm.__wbg_set_cliargs_heartbeat_threshold(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {number | undefined}
    */
    get heartbeat_variance() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_heartbeat_variance(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set heartbeat_variance(arg0) {
        wasm.__wbg_set_cliargs_heartbeat_variance(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {number | undefined}
    */
    get on_chain_confirmations() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_on_chain_confirmations(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set on_chain_confirmations(arg0) {
        wasm.__wbg_set_cliargs_on_chain_confirmations(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {number | undefined}
    */
    get network_quality_threshold() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_network_quality_threshold(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getFloat32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set network_quality_threshold(arg0) {
        wasm.__wbg_set_cliargs_network_quality_threshold(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {string | undefined}
    */
    get configuration_file_path() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_cliargs_configuration_file_path(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set configuration_file_path(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_cliargs_configuration_file_path(this.__wbg_ptr, ptr0, len0);
    }
}

const CoreConstantsFinalization = new FinalizationRegistry(ptr => wasm.__wbg_coreconstants_free(ptr >>> 0));
/**
*/
export class CoreConstants {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CoreConstants.prototype);
        obj.__wbg_ptr = ptr;
        CoreConstantsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CoreConstantsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_coreconstants_free(ptr);
    }
    /**
    * @returns {number}
    */
    get DEFAULT_HEARTBEAT_INTERVAL() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_HEARTBEAT_INTERVAL(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get DEFAULT_HEARTBEAT_THRESHOLD() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_HEARTBEAT_THRESHOLD(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get DEFAULT_HEARTBEAT_INTERVAL_VARIANCE() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_HEARTBEAT_INTERVAL_VARIANCE(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get DEFAULT_NETWORK_QUALITY_THRESHOLD() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_NETWORK_QUALITY_THRESHOLD(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {number}
    */
    get DEFAULT_MAX_PARALLEL_CONNECTIONS() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_MAX_PARALLEL_CONNECTIONS(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get DEFAULT_MAX_PARALLEL_CONNECTIONS_PUBLIC_RELAY() {
        const ret = wasm.__wbg_get_coreconstants_DEFAULT_MAX_PARALLEL_CONNECTIONS_PUBLIC_RELAY(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const CoreEthereumConstantsFinalization = new FinalizationRegistry(ptr => wasm.__wbg_coreethereumconstants_free(ptr >>> 0));
/**
*/
export class CoreEthereumConstants {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CoreEthereumConstants.prototype);
        obj.__wbg_ptr = ptr;
        CoreEthereumConstantsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CoreEthereumConstantsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_coreethereumconstants_free(ptr);
    }
    /**
    * @returns {number}
    */
    get DEFAULT_CONFIRMATIONS() {
        const ret = wasm.__wbg_get_coreethereumconstants_DEFAULT_CONFIRMATIONS(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get PROVIDER_CACHE_TTL() {
        const ret = wasm.__wbg_get_coreethereumconstants_PROVIDER_CACHE_TTL(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get TX_CONFIRMATION_WAIT() {
        const ret = wasm.__wbg_get_coreethereumconstants_TX_CONFIRMATION_WAIT(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get INDEXER_BLOCK_RANGE() {
        const ret = wasm.__wbg_get_coreethereumconstants_INDEXER_BLOCK_RANGE(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get INDEXER_TIMEOUT() {
        const ret = wasm.__wbg_get_coreethereumconstants_INDEXER_TIMEOUT(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    get MAX_TRANSACTION_BACKOFF() {
        const ret = wasm.__wbg_get_coreethereumconstants_MAX_TRANSACTION_BACKOFF(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const CurvePointFinalization = new FinalizationRegistry(ptr => wasm.__wbg_curvepoint_free(ptr >>> 0));
/**
* Represent an uncompressed elliptic curve point on the secp256k1 curve
*/
export class CurvePoint {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CurvePoint.prototype);
        obj.__wbg_ptr = ptr;
        CurvePointFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CurvePointFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_curvepoint_free(ptr);
    }
    /**
    * Converts the uncompressed representation of the curve point to Ethereum address.
    * @returns {Address}
    */
    to_address() {
        const ret = wasm.curvepoint_to_address(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * @param {Uint8Array} exponent
    * @returns {CurvePoint}
    */
    static from_exponent(exponent) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(exponent, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.curvepoint_from_exponent(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return CurvePoint.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string} str
    * @returns {CurvePoint}
    */
    static from_str(str) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.curvepoint_from_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return CurvePoint.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string} peer_id
    * @returns {CurvePoint}
    */
    static from_peerid_str(peer_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(peer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.curvepoint_from_peerid_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return CurvePoint.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_peerid_str() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.curvepoint_to_peerid_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {CurvePoint}
    */
    static deserialize(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.curvepoint_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return CurvePoint.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.curvepoint_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.curvepoint_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize_compressed() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.curvepoint_serialize_compressed(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {CurvePoint} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, CurvePoint);
        const ret = wasm.curvepoint_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {CurvePoint}
    */
    clone() {
        const ret = wasm.curvepoint_clone(this.__wbg_ptr);
        return CurvePoint.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.curvepoint_size();
        return ret >>> 0;
    }
}

const DatabaseFinalization = new FinalizationRegistry(ptr => wasm.__wbg_database_free(ptr >>> 0));
/**
*/
export class Database {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Database.prototype);
        obj.__wbg_ptr = ptr;
        DatabaseFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DatabaseFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_database_free(ptr);
    }
    /**
    * @param {any} db
    * @param {PublicKey} public_key
    */
    constructor(db, public_key) {
        _assertClass(public_key, PublicKey);
        var ptr0 = public_key.__destroy_into_raw();
        const ret = wasm.database_new(db, ptr0);
        return Database.__wrap(ret);
    }
    /**
    * @param {ChannelEntry | undefined} filter
    * @returns {Promise<WasmVecAcknowledgedTicket>}
    */
    get_acknowledged_tickets(filter) {
        let ptr0 = 0;
        if (!isLikeNone(filter)) {
            _assertClass(filter, ChannelEntry);
            ptr0 = filter.__destroy_into_raw();
        }
        const ret = wasm.database_get_acknowledged_tickets(this.__wbg_ptr, ptr0);
        return ret;
    }
    /**
    * @param {ChannelEntry} source
    * @returns {Promise<void>}
    */
    delete_acknowledged_tickets_from(source) {
        _assertClass(source, ChannelEntry);
        var ptr0 = source.__destroy_into_raw();
        const ret = wasm.database_delete_acknowledged_tickets_from(this.__wbg_ptr, ptr0);
        return ret;
    }
    /**
    * @param {AcknowledgedTicket} ticket
    * @returns {Promise<void>}
    */
    delete_acknowledged_ticket(ticket) {
        _assertClass(ticket, AcknowledgedTicket);
        const ret = wasm.database_delete_acknowledged_ticket(this.__wbg_ptr, ticket.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Hash} channel
    * @param {number} iteration
    * @returns {Promise<Hash | undefined>}
    */
    get_commitment(channel, iteration) {
        _assertClass(channel, Hash);
        const ret = wasm.database_get_commitment(this.__wbg_ptr, channel.__wbg_ptr, iteration);
        return ret;
    }
    /**
    * @param {Hash} channel
    * @returns {Promise<Hash | undefined>}
    */
    get_current_commitment(channel) {
        _assertClass(channel, Hash);
        const ret = wasm.database_get_current_commitment(this.__wbg_ptr, channel.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Hash} channel
    * @param {Hash} commitment
    * @returns {Promise<void>}
    */
    set_current_commitment(channel, commitment) {
        _assertClass(channel, Hash);
        _assertClass(commitment, Hash);
        const ret = wasm.database_set_current_commitment(this.__wbg_ptr, channel.__wbg_ptr, commitment.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_latest_block_number() {
        const ret = wasm.database_get_latest_block_number(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} number
    * @returns {Promise<void>}
    */
    update_latest_block_number(number) {
        const ret = wasm.database_update_latest_block_number(this.__wbg_ptr, number);
        return ret;
    }
    /**
    * @returns {Promise<Snapshot | undefined>}
    */
    get_latest_confirmed_snapshot() {
        const ret = wasm.database_get_latest_confirmed_snapshot(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Hash} channel
    * @returns {Promise<ChannelEntry | undefined>}
    */
    get_channel(channel) {
        _assertClass(channel, Hash);
        const ret = wasm.database_get_channel(this.__wbg_ptr, channel.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<WasmVecChannelEntry>}
    */
    get_channels() {
        const ret = wasm.database_get_channels(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<WasmVecChannelEntry>}
    */
    get_channels_open() {
        const ret = wasm.database_get_channels_open(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Hash} channel_id
    * @param {ChannelEntry} channel
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    update_channel_and_snapshot(channel_id, channel, snapshot) {
        _assertClass(channel_id, Hash);
        _assertClass(channel, ChannelEntry);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_update_channel_and_snapshot(this.__wbg_ptr, channel_id.__wbg_ptr, channel.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} address
    * @returns {Promise<AccountEntry | undefined>}
    */
    get_account(address) {
        _assertClass(address, Address);
        const ret = wasm.database_get_account(this.__wbg_ptr, address.__wbg_ptr);
        return ret;
    }
    /**
    * @param {AccountEntry} account
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    update_account_and_snapshot(account, snapshot) {
        _assertClass(account, AccountEntry);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_update_account_and_snapshot(this.__wbg_ptr, account.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<WasmVecAccountEntry>}
    */
    get_accounts() {
        const ret = wasm.database_get_accounts(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<Balance>}
    */
    get_redeemed_tickets_value() {
        const ret = wasm.database_get_redeemed_tickets_value(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_redeemed_tickets_count() {
        const ret = wasm.database_get_redeemed_tickets_count(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_neglected_tickets_count() {
        const ret = wasm.database_get_neglected_tickets_count(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_pending_tickets_count() {
        const ret = wasm.database_get_pending_tickets_count(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_losing_tickets_count() {
        const ret = wasm.database_get_losing_tickets_count(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} counterparty
    * @returns {Promise<Balance>}
    */
    get_pending_balance_to(counterparty) {
        _assertClass(counterparty, Address);
        const ret = wasm.database_get_pending_balance_to(this.__wbg_ptr, counterparty.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Ticket} ticket
    * @returns {Promise<void>}
    */
    mark_pending(ticket) {
        _assertClass(ticket, Ticket);
        const ret = wasm.database_mark_pending(this.__wbg_ptr, ticket.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Ticket} ticket
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    resolve_pending(ticket, snapshot) {
        _assertClass(ticket, Ticket);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_resolve_pending(this.__wbg_ptr, ticket.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {AcknowledgedTicket} ticket
    * @returns {Promise<void>}
    */
    mark_redeemed(ticket) {
        _assertClass(ticket, AcknowledgedTicket);
        const ret = wasm.database_mark_redeemed(this.__wbg_ptr, ticket.__wbg_ptr);
        return ret;
    }
    /**
    * @param {AcknowledgedTicket} ticket
    * @returns {Promise<void>}
    */
    mark_losing_acked_ticket(ticket) {
        _assertClass(ticket, AcknowledgedTicket);
        const ret = wasm.database_mark_losing_acked_ticket(this.__wbg_ptr, ticket.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<Balance>}
    */
    get_rejected_tickets_value() {
        const ret = wasm.database_get_rejected_tickets_value(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<number>}
    */
    get_rejected_tickets_count() {
        const ret = wasm.database_get_rejected_tickets_count(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} src
    * @param {PublicKey} dest
    * @returns {Promise<ChannelEntry | undefined>}
    */
    get_channel_x(src, dest) {
        _assertClass(src, PublicKey);
        _assertClass(dest, PublicKey);
        const ret = wasm.database_get_channel_x(this.__wbg_ptr, src.__wbg_ptr, dest.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} dest
    * @returns {Promise<ChannelEntry | undefined>}
    */
    get_channel_to(dest) {
        _assertClass(dest, PublicKey);
        const ret = wasm.database_get_channel_to(this.__wbg_ptr, dest.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} src
    * @returns {Promise<ChannelEntry | undefined>}
    */
    get_channel_from(src) {
        _assertClass(src, PublicKey);
        const ret = wasm.database_get_channel_from(this.__wbg_ptr, src.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} address
    * @returns {Promise<WasmVecChannelEntry>}
    */
    get_channels_from(address) {
        _assertClass(address, Address);
        var ptr0 = address.__destroy_into_raw();
        const ret = wasm.database_get_channels_from(this.__wbg_ptr, ptr0);
        return ret;
    }
    /**
    * @param {Address} address
    * @returns {Promise<WasmVecChannelEntry>}
    */
    get_channels_to(address) {
        _assertClass(address, Address);
        var ptr0 = address.__destroy_into_raw();
        const ret = wasm.database_get_channels_to(this.__wbg_ptr, ptr0);
        return ret;
    }
    /**
    * @returns {Promise<Balance>}
    */
    get_hopr_balance() {
        const ret = wasm.database_get_hopr_balance(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Balance} balance
    * @returns {Promise<void>}
    */
    set_hopr_balance(balance) {
        _assertClass(balance, Balance);
        const ret = wasm.database_set_hopr_balance(this.__wbg_ptr, balance.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Balance} balance
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    add_hopr_balance(balance, snapshot) {
        _assertClass(balance, Balance);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_add_hopr_balance(this.__wbg_ptr, balance.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Balance} balance
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    sub_hopr_balance(balance, snapshot) {
        _assertClass(balance, Balance);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_sub_hopr_balance(this.__wbg_ptr, balance.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Promise<boolean>}
    */
    is_network_registry_enabled() {
        const ret = wasm.database_is_network_registry_enabled(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {boolean} enabled
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    set_network_registry(enabled, snapshot) {
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_set_network_registry(this.__wbg_ptr, enabled, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} public_key
    * @param {Address} account
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    add_to_network_registry(public_key, account, snapshot) {
        _assertClass(public_key, PublicKey);
        _assertClass(account, Address);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_add_to_network_registry(this.__wbg_ptr, public_key.__wbg_ptr, account.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} public_key
    * @param {Address} account
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    remove_from_network_registry(public_key, account, snapshot) {
        _assertClass(public_key, PublicKey);
        _assertClass(account, Address);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_remove_from_network_registry(this.__wbg_ptr, public_key.__wbg_ptr, account.__wbg_ptr, snapshot.__wbg_ptr);
        return ret;
    }
    /**
    * @param {PublicKey} public_key
    * @returns {Promise<Address | undefined>}
    */
    get_account_from_network_registry(public_key) {
        _assertClass(public_key, PublicKey);
        const ret = wasm.database_get_account_from_network_registry(this.__wbg_ptr, public_key.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} account
    * @returns {Promise<WasmVecPublicKey>}
    */
    find_hopr_node_using_account_in_network_registry(account) {
        _assertClass(account, Address);
        const ret = wasm.database_find_hopr_node_using_account_in_network_registry(this.__wbg_ptr, account.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} account
    * @returns {Promise<boolean>}
    */
    is_eligible(account) {
        _assertClass(account, Address);
        const ret = wasm.database_is_eligible(this.__wbg_ptr, account.__wbg_ptr);
        return ret;
    }
    /**
    * @param {Address} account
    * @param {boolean} eligible
    * @param {Snapshot} snapshot
    * @returns {Promise<void>}
    */
    set_eligible(account, eligible, snapshot) {
        _assertClass(account, Address);
        _assertClass(snapshot, Snapshot);
        const ret = wasm.database_set_eligible(this.__wbg_ptr, account.__wbg_ptr, eligible, snapshot.__wbg_ptr);
        return ret;
    }
}

const DbFinalization = new FinalizationRegistry(ptr => wasm.__wbg_db_free(ptr >>> 0));
/**
*/
export class Db {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Db.prototype);
        obj.__wbg_ptr = ptr;
        DbFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DbFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_db_free(ptr);
    }
    /**
    * Path to the directory containing the database
    * @returns {string}
    */
    get data() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_db_data(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * Path to the directory containing the database
    * @param {string} arg0
    */
    set data(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_db_data(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {boolean}
    */
    get initialize() {
        const ret = wasm.__wbg_get_db_initialize(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set initialize(arg0) {
        wasm.__wbg_set_db_initialize(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get force_initialize() {
        const ret = wasm.__wbg_get_db_force_initialize(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set force_initialize(arg0) {
        wasm.__wbg_set_db_force_initialize(this.__wbg_ptr, arg0);
    }
}

const EthereumChallengeFinalization = new FinalizationRegistry(ptr => wasm.__wbg_ethereumchallenge_free(ptr >>> 0));
/**
* Represents and Ethereum challenge.
*/
export class EthereumChallenge {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(EthereumChallenge.prototype);
        obj.__wbg_ptr = ptr;
        EthereumChallengeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EthereumChallengeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ethereumchallenge_free(ptr);
    }
    /**
    * @param {Uint8Array} data
    */
    constructor(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.ethereumchallenge_new(ptr0, len0);
        return EthereumChallenge.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {EthereumChallenge}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.ethereumchallenge_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return EthereumChallenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ethereumchallenge_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ethereumchallenge_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {EthereumChallenge} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, EthereumChallenge);
        const ret = wasm.ethereumchallenge_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {EthereumChallenge}
    */
    clone() {
        const ret = wasm.ethereumchallenge_clone(this.__wbg_ptr);
        return EthereumChallenge.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.address_size();
        return ret >>> 0;
    }
}

const GroupElementFinalization = new FinalizationRegistry(ptr => wasm.__wbg_groupelement_free(ptr >>> 0));
/**
*/
export class GroupElement {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(GroupElement.prototype);
        obj.__wbg_ptr = ptr;
        GroupElementFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GroupElementFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_groupelement_free(ptr);
    }
    /**
    * @returns {GroupElement}
    */
    static random() {
        const ret = wasm.groupelement_random();
        return GroupElement.__wrap(ret);
    }
    /**
    * @returns {Uint8Array}
    */
    coefficient() {
        const ret = wasm.groupelement_coefficient(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {CurvePoint}
    */
    element() {
        const ret = wasm.groupelement_element(this.__wbg_ptr);
        return CurvePoint.__wrap(ret);
    }
}

const HalfKeyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_halfkey_free(ptr >>> 0));
/**
* Represents a half-key used for Proof of Relay
* Half-key is equivalent to a non-zero scalar in the field used by secp256k1, but the type
* itself does not validate nor enforce this fact,
*/
export class HalfKey {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(HalfKey.prototype);
        obj.__wbg_ptr = ptr;
        HalfKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HalfKeyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_halfkey_free(ptr);
    }
    /**
    * @param {Uint8Array} half_key
    */
    constructor(half_key) {
        const ptr0 = passArray8ToWasm0(half_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.halfkey_new(ptr0, len0);
        return HalfKey.__wrap(ret);
    }
    /**
    * Converts the non-zero scalar represented by this half-key into the half-key challenge.
    * This operation naturally enforces the underlying scalar to be non-zero.
    * @returns {HalfKeyChallenge}
    */
    to_challenge() {
        const ret = wasm.halfkey_to_challenge(this.__wbg_ptr);
        return HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {HalfKey}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.halfkey_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return HalfKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.halfkey_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.halfkey_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {HalfKey}
    */
    clone() {
        const ret = wasm.halfkey_clone(this.__wbg_ptr);
        return HalfKey.__wrap(ret);
    }
    /**
    * @param {HalfKey} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, HalfKey);
        const ret = wasm.halfkey_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.halfkey_size();
        return ret >>> 0;
    }
}

const HalfKeyChallengeFinalization = new FinalizationRegistry(ptr => wasm.__wbg_halfkeychallenge_free(ptr >>> 0));
/**
* Represents a challenge for the half-key in Proof of Relay.
* Half-key challenge is equivalent to a secp256k1 curve point.
* Therefore, HalfKeyChallenge can be obtained from a HalfKey.
*/
export class HalfKeyChallenge {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(HalfKeyChallenge.prototype);
        obj.__wbg_ptr = ptr;
        HalfKeyChallengeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HalfKeyChallengeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_halfkeychallenge_free(ptr);
    }
    /**
    * @param {Uint8Array} half_key_challenge
    */
    constructor(half_key_challenge) {
        const ptr0 = passArray8ToWasm0(half_key_challenge, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.halfkeychallenge_new(ptr0, len0);
        return HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @returns {Address}
    */
    to_address() {
        const ret = wasm.halfkeychallenge_to_address(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.halfkeychallenge_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {HalfKeyChallenge} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, HalfKeyChallenge);
        const ret = wasm.halfkeychallenge_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {string}
    */
    to_peerid_str() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.halfkeychallenge_to_peerid_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} str
    * @returns {HalfKeyChallenge}
    */
    static from_str(str) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.halfkeychallenge_from_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return HalfKeyChallenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string} peer_id
    * @returns {HalfKeyChallenge}
    */
    static from_peerid_str(peer_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(peer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.halfkeychallenge_from_peerid_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return HalfKeyChallenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} data
    * @returns {HalfKeyChallenge}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.halfkeychallenge_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return HalfKeyChallenge.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.halfkeychallenge_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {HalfKeyChallenge}
    */
    clone() {
        const ret = wasm.halfkeychallenge_clone(this.__wbg_ptr);
        return HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.challenge_size();
        return ret >>> 0;
    }
}

const HashFinalization = new FinalizationRegistry(ptr => wasm.__wbg_hash_free(ptr >>> 0));
/**
* Represents an Ethereum 256-bit hash value
* This implementation instantiates the hash via Keccak256 digest.
*/
export class Hash {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Hash.prototype);
        obj.__wbg_ptr = ptr;
        HashFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HashFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_hash_free(ptr);
    }
    /**
    * @param {Uint8Array} hash
    */
    constructor(hash) {
        const ptr0 = passArray8ToWasm0(hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.hash_new(ptr0, len0);
        return Hash.__wrap(ret);
    }
    /**
    * Convenience method that creates a new hash by hashing this.
    * @returns {Hash}
    */
    hash() {
        const ret = wasm.hash_hash(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * @param {(Uint8Array)[]} inputs
    * @returns {Hash}
    */
    static create(inputs) {
        const ptr0 = passArrayJsValueToWasm0(inputs, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.hash_create(ptr0, len0);
        return Hash.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {Hash}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.hash_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Hash.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.hash_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.hash_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Hash} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, Hash);
        const ret = wasm.hash_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {Hash}
    */
    clone() {
        const ret = wasm.hash_clone(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.halfkey_size();
        return ret >>> 0;
    }
}

const HealthCheckFinalization = new FinalizationRegistry(ptr => wasm.__wbg_healthcheck_free(ptr >>> 0));
/**
*/
export class HealthCheck {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(HealthCheck.prototype);
        obj.__wbg_ptr = ptr;
        HealthCheckFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HealthCheckFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_healthcheck_free(ptr);
    }
    /**
    * @returns {boolean}
    */
    get enable() {
        const ret = wasm.__wbg_get_healthcheck_enable(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set enable(arg0) {
        wasm.__wbg_set_healthcheck_enable(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {string}
    */
    get host() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_db_data(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set host(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_db_data(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number}
    */
    get port() {
        const ret = wasm.__wbg_get_healthcheck_port(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} arg0
    */
    set port(arg0) {
        wasm.__wbg_set_healthcheck_port(this.__wbg_ptr, arg0);
    }
}

const HeartbeatFinalization = new FinalizationRegistry(ptr => wasm.__wbg_heartbeat_free(ptr >>> 0));
/**
*/
export class Heartbeat {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Heartbeat.prototype);
        obj.__wbg_ptr = ptr;
        HeartbeatFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HeartbeatFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_heartbeat_free(ptr);
    }
    /**
    * @returns {number}
    */
    get interval() {
        const ret = wasm.__wbg_get_heartbeat_interval(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set interval(arg0) {
        wasm.__wbg_set_heartbeat_interval(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {number}
    */
    get threshold() {
        const ret = wasm.__wbg_get_heartbeat_threshold(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set threshold(arg0) {
        wasm.__wbg_set_heartbeat_threshold(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {number}
    */
    get variance() {
        const ret = wasm.__wbg_get_heartbeat_variance(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set variance(arg0) {
        wasm.__wbg_set_heartbeat_variance(this.__wbg_ptr, arg0);
    }
}

const HoprdConfigFinalization = new FinalizationRegistry(ptr => wasm.__wbg_hoprdconfig_free(ptr >>> 0));
/**
*/
export class HoprdConfig {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(HoprdConfig.prototype);
        obj.__wbg_ptr = ptr;
        HoprdConfigFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HoprdConfigFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_hoprdconfig_free(ptr);
    }
    /**
    * @returns {string}
    */
    as_redacted_string() {
        let deferred2_0;
        let deferred2_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.hoprdconfig_as_redacted_string(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            var ptr1 = r0;
            var len1 = r1;
            if (r3) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(r2);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred2_0, deferred2_1);
        }
    }
    /**
    * @returns {Host}
    */
    get host() {
        const ret = wasm.__wbg_get_hoprdconfig_host(this.__wbg_ptr);
        return Host.__wrap(ret);
    }
    /**
    * @param {Host} arg0
    */
    set host(arg0) {
        _assertClass(arg0, Host);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_host(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Identity}
    */
    get identity() {
        const ret = wasm.__wbg_get_hoprdconfig_identity(this.__wbg_ptr);
        return Identity.__wrap(ret);
    }
    /**
    * @param {Identity} arg0
    */
    set identity(arg0) {
        _assertClass(arg0, Identity);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_identity(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Db}
    */
    get db() {
        const ret = wasm.__wbg_get_hoprdconfig_db(this.__wbg_ptr);
        return Db.__wrap(ret);
    }
    /**
    * @param {Db} arg0
    */
    set db(arg0) {
        _assertClass(arg0, Db);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_db(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Api}
    */
    get api() {
        const ret = wasm.__wbg_get_hoprdconfig_api(this.__wbg_ptr);
        return Api.__wrap(ret);
    }
    /**
    * @param {Api} arg0
    */
    set api(arg0) {
        _assertClass(arg0, Api);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_api(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Strategy}
    */
    get strategy() {
        const ret = wasm.__wbg_get_hoprdconfig_strategy(this.__wbg_ptr);
        return Strategy.__wrap(ret);
    }
    /**
    * @param {Strategy} arg0
    */
    set strategy(arg0) {
        _assertClass(arg0, Strategy);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_strategy(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Heartbeat}
    */
    get heartbeat() {
        const ret = wasm.__wbg_get_hoprdconfig_heartbeat(this.__wbg_ptr);
        return Heartbeat.__wrap(ret);
    }
    /**
    * @param {Heartbeat} arg0
    */
    set heartbeat(arg0) {
        _assertClass(arg0, Heartbeat);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_heartbeat(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {NetworkOptions}
    */
    get network_options() {
        const ret = wasm.__wbg_get_hoprdconfig_network_options(this.__wbg_ptr);
        return NetworkOptions.__wrap(ret);
    }
    /**
    * @param {NetworkOptions} arg0
    */
    set network_options(arg0) {
        _assertClass(arg0, NetworkOptions);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_network_options(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {HealthCheck}
    */
    get healthcheck() {
        const ret = wasm.__wbg_get_hoprdconfig_healthcheck(this.__wbg_ptr);
        return HealthCheck.__wrap(ret);
    }
    /**
    * @param {HealthCheck} arg0
    */
    set healthcheck(arg0) {
        _assertClass(arg0, HealthCheck);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_healthcheck(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {string}
    */
    get network() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_hoprdconfig_network(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set network(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_hoprdconfig_network(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {Chain}
    */
    get chain() {
        const ret = wasm.__wbg_get_hoprdconfig_chain(this.__wbg_ptr);
        return Chain.__wrap(ret);
    }
    /**
    * @param {Chain} arg0
    */
    set chain(arg0) {
        _assertClass(arg0, Chain);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_chain(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Testing}
    */
    get test() {
        const ret = wasm.__wbg_get_hoprdconfig_test(this.__wbg_ptr);
        return Testing.__wrap(ret);
    }
    /**
    * @param {Testing} arg0
    */
    set test(arg0) {
        _assertClass(arg0, Testing);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_hoprdconfig_test(this.__wbg_ptr, ptr0);
    }
}

const HostFinalization = new FinalizationRegistry(ptr => wasm.__wbg_host_free(ptr >>> 0));
/**
*/
export class Host {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Host.prototype);
        obj.__wbg_ptr = ptr;
        HostFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HostFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_host_free(ptr);
    }
    /**
    * @returns {string}
    */
    get ip() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_db_data(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set ip(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_db_data(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number}
    */
    get port() {
        const ret = wasm.__wbg_get_healthcheck_port(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} arg0
    */
    set port(arg0) {
        wasm.__wbg_set_healthcheck_port(this.__wbg_ptr, arg0);
    }
}

const IdentityFinalization = new FinalizationRegistry(ptr => wasm.__wbg_identity_free(ptr >>> 0));
/**
*/
export class Identity {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Identity.prototype);
        obj.__wbg_ptr = ptr;
        IdentityFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IdentityFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_identity_free(ptr);
    }
    /**
    * @returns {string}
    */
    get file() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_identity_file(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set file(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_identity_file(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string}
    */
    get password() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_identity_password(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set password(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_identity_password(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {string | undefined}
    */
    get private_key() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chain_provider(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_free(r0, r1 * 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string | undefined} arg0
    */
    set private_key(arg0) {
        var ptr0 = isLikeNone(arg0) ? 0 : passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chain_provider(this.__wbg_ptr, ptr0, len0);
    }
}

const IntermediateFinalization = new FinalizationRegistry(ptr => wasm.__wbg_intermediate_free(ptr >>> 0));
/**
* Contains the intermediate result in the hash iteration progression
*/
export class Intermediate {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Intermediate.prototype);
        obj.__wbg_ptr = ptr;
        IntermediateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntermediateFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intermediate_free(ptr);
    }
    /**
    * @returns {number}
    */
    get iteration() {
        const ret = wasm.__wbg_get_intermediate_iteration(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set iteration(arg0) {
        wasm.__wbg_set_intermediate_iteration(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {Uint8Array}
    */
    get intermediate() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_intermediate_intermediate(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} arg0
    */
    set intermediate(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_intermediate_intermediate(this.__wbg_ptr, ptr0, len0);
    }
}

const IteratedHashFinalization = new FinalizationRegistry(ptr => wasm.__wbg_iteratedhash_free(ptr >>> 0));
/**
*/
export class IteratedHash {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IteratedHash.prototype);
        obj.__wbg_ptr = ptr;
        IteratedHashFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IteratedHashFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_iteratedhash_free(ptr);
    }
    /**
    * @returns {Uint8Array}
    */
    hash() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.iteratedhash_hash(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    count_intermediates() {
        const ret = wasm.iteratedhash_count_intermediates(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} index
    * @returns {Intermediate | undefined}
    */
    intermediate(index) {
        const ret = wasm.iteratedhash_intermediate(this.__wbg_ptr, index);
        return ret === 0 ? undefined : Intermediate.__wrap(ret);
    }
}

const IteratorResultFinalization = new FinalizationRegistry(ptr => wasm.__wbg_iteratorresult_free(ptr >>> 0));
/**
*/
export class IteratorResult {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IteratorResultFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_iteratorresult_free(ptr);
    }
}

const KeyPairFinalization = new FinalizationRegistry(ptr => wasm.__wbg_keypair_free(ptr >>> 0));
/**
*/
export class KeyPair {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(KeyPair.prototype);
        obj.__wbg_ptr = ptr;
        KeyPairFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        KeyPairFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_keypair_free(ptr);
    }
    /**
    * @returns {Uint8Array}
    */
    get private() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_keypair_private(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} arg0
    */
    set private(arg0) {
        const ptr0 = passArray8ToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_keypair_private(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {PublicKey}
    */
    get public() {
        const ret = wasm.__wbg_get_keypair_public(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set public(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_keypair_public(this.__wbg_ptr, ptr0);
    }
}

const NetworkFinalization = new FinalizationRegistry(ptr => wasm.__wbg_network_free(ptr >>> 0));
/**
* Holds all information about the protocol network
* to be used by the client
*/
export class Network {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NetworkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_network_free(ptr);
    }
    /**
    * @returns {string}
    */
    get id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_id(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set id(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_id(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * must match one of the Network.id
    * @returns {string}
    */
    get chain() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_chain(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * must match one of the Network.id
    * @param {string} arg0
    */
    set chain(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_chain(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number}
    */
    get environment_type() {
        const ret = wasm.__wbg_get_network_environment_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set environment_type(arg0) {
        wasm.__wbg_set_network_environment_type(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {string}
    */
    get version_range() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_version_range(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set version_range(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_version_range(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number}
    */
    get indexer_start_block_number() {
        const ret = wasm.__wbg_get_network_indexer_start_block_number(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set indexer_start_block_number(arg0) {
        wasm.__wbg_set_network_indexer_start_block_number(this.__wbg_ptr, arg0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get token_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_token_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set token_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_token_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get channels_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_channels_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set channels_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_channels_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get xhopr_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_xhopr_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set xhopr_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_xhopr_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get boost_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_boost_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set boost_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_boost_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get stake_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_stake_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set stake_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_stake_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get network_registry_proxy_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_network_registry_proxy_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set network_registry_proxy_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_network_registry_proxy_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get network_registry_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_network_registry_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set network_registry_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_network_network_registry_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * the associated staking season
    * @returns {number | undefined}
    */
    get stake_season() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_network_stake_season(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * the associated staking season
    * @param {number | undefined} arg0
    */
    set stake_season(arg0) {
        wasm.__wbg_set_network_stake_season(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
}

const NetworkOptionsFinalization = new FinalizationRegistry(ptr => wasm.__wbg_networkoptions_free(ptr >>> 0));
/**
*/
export class NetworkOptions {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(NetworkOptions.prototype);
        obj.__wbg_ptr = ptr;
        NetworkOptionsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NetworkOptionsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_networkoptions_free(ptr);
    }
    /**
    * @returns {boolean}
    */
    get announce() {
        const ret = wasm.__wbg_get_networkoptions_announce(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set announce(arg0) {
        wasm.__wbg_set_networkoptions_announce(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get allow_local_node_connections() {
        const ret = wasm.__wbg_get_networkoptions_allow_local_node_connections(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set allow_local_node_connections(arg0) {
        wasm.__wbg_set_networkoptions_allow_local_node_connections(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get allow_private_node_connections() {
        const ret = wasm.__wbg_get_networkoptions_allow_private_node_connections(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set allow_private_node_connections(arg0) {
        wasm.__wbg_set_networkoptions_allow_private_node_connections(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {number}
    */
    get max_parallel_connections() {
        const ret = wasm.__wbg_get_heartbeat_interval(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set max_parallel_connections(arg0) {
        wasm.__wbg_set_heartbeat_interval(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {number}
    */
    get network_quality_threshold() {
        const ret = wasm.__wbg_get_networkoptions_network_quality_threshold(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} arg0
    */
    set network_quality_threshold(arg0) {
        wasm.__wbg_set_networkoptions_network_quality_threshold(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get no_relay() {
        const ret = wasm.__wbg_get_networkoptions_no_relay(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set no_relay(arg0) {
        wasm.__wbg_set_networkoptions_no_relay(this.__wbg_ptr, arg0);
    }
}

const OffchainPublicKeyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_offchainpublickey_free(ptr >>> 0));
/**
* Represents an Ed25519 public key.
* This public key is always internally in a compressed form, and therefore unsuitable for calculations.
* Because of this fact, the OffchainPublicKey is BinarySerializable as opposed to PublicKey
*/
export class OffchainPublicKey {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(OffchainPublicKey.prototype);
        obj.__wbg_ptr = ptr;
        OffchainPublicKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        OffchainPublicKeyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_offchainpublickey_free(ptr);
    }
    /**
    * Generates a new random public key.
    * Because the corresponding private key is discarded, this might be useful only for testing purposes.
    * @returns {OffchainPublicKey}
    */
    static random() {
        const ret = wasm.offchainpublickey_random();
        return OffchainPublicKey.__wrap(ret);
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {OffchainPublicKey}
    */
    static deserialize(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.offchainpublickey_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return OffchainPublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.offchainpublickey_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string} peer_id
    * @returns {OffchainPublicKey}
    */
    static from_peerid_str(peer_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(peer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.offchainpublickey_from_peerid_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return OffchainPublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_peerid_str() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.offchainpublickey_to_peerid_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Uint8Array} private_key
    * @returns {OffchainPublicKey}
    */
    static from_privkey(private_key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.offchainpublickey_from_privkey(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return OffchainPublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {OffchainPublicKey} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, OffchainPublicKey);
        const ret = wasm.offchainpublickey_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {OffchainPublicKey}
    */
    clone() {
        const ret = wasm.offchainpublickey_clone(this.__wbg_ptr);
        return OffchainPublicKey.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.halfkey_size();
        return ret >>> 0;
    }
}

const PRGFinalization = new FinalizationRegistry(ptr => wasm.__wbg_prg_free(ptr >>> 0));
/**
* Pseudo-Random Generator (PRG) function that is instantiated
* using AES-128 block cipher in Counter mode (with 32-bit counter).
* It forms an infinite sequence of pseudo-random bytes (generated deterministically from the parameters)
* and can be queried by chunks using the `digest` function.
*/
export class PRG {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PRG.prototype);
        obj.__wbg_ptr = ptr;
        PRGFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PRGFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_prg_free(ptr);
    }
    /**
    * @param {number} from
    * @param {number} to
    * @returns {Uint8Array}
    */
    digest(from, to) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.prg_digest(retptr, this.__wbg_ptr, from, to);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Creates a PRG instance  using the raw key and IV for the underlying block cipher.
    * @param {Uint8Array} key
    * @param {Uint8Array} iv
    */
    constructor(key, iv) {
        const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(iv, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.prg_new(ptr0, len0, ptr1, len1);
        return PRG.__wrap(ret);
    }
    /**
    * Creates a new PRG instance using the given parameters
    * @param {PRGParameters} params
    * @returns {PRG}
    */
    static from_parameters(params) {
        _assertClass(params, PRGParameters);
        var ptr0 = params.__destroy_into_raw();
        const ret = wasm.prg_from_parameters(ptr0);
        return PRG.__wrap(ret);
    }
}

const PRGParametersFinalization = new FinalizationRegistry(ptr => wasm.__wbg_prgparameters_free(ptr >>> 0));
/**
* Parameters for the Pseudo-Random Generator (PRG) function
* This consists of IV and the raw secret key for use by the underlying block cipher.
*/
export class PRGParameters {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PRGParameters.prototype);
        obj.__wbg_ptr = ptr;
        PRGParametersFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PRGParametersFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_prgparameters_free(ptr);
    }
    /**
    * @returns {Uint8Array}
    */
    key() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.prgparameters_key(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    iv() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.prgparameters_iv(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Creates new parameters for the PRG by expanding the given
    * keying material into the secret key and IV for the underlying block cipher.
    * @param {Uint8Array} secret
    */
    constructor(secret) {
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.prgparameters_new(ptr0, len0);
        return PRGParameters.__wrap(ret);
    }
}

const PRPFinalization = new FinalizationRegistry(ptr => wasm.__wbg_prp_free(ptr >>> 0));
/**
* Implementation of Pseudo-Random Permutation (PRP).
* Currently based on the Lioness wide-block cipher.
*/
export class PRP {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PRP.prototype);
        obj.__wbg_ptr = ptr;
        PRPFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PRPFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_prp_free(ptr);
    }
    /**
    * @param {Uint8Array} plaintext
    * @returns {Uint8Array}
    */
    forward(plaintext) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.prp_forward(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            var v2 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} ciphertext
    * @returns {Uint8Array}
    */
    inverse(ciphertext) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.prp_inverse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            var r3 = getInt32Memory0()[retptr / 4 + 3];
            if (r3) {
                throw takeFromExternrefTable0(r2);
            }
            var v2 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Creates new instance of the PRP using the raw key and IV.
    * @param {Uint8Array} key
    * @param {Uint8Array} iv
    * @returns {PRP}
    */
    static new(key, iv) {
        const ptr0 = passArray8ToWasm0(key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(iv, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.prp_new(ptr0, len0, ptr1, len1);
        return PRP.__wrap(ret);
    }
    /**
    * Creates a new PRP instance using the given parameters
    * @param {PRPParameters} params
    */
    constructor(params) {
        _assertClass(params, PRPParameters);
        var ptr0 = params.__destroy_into_raw();
        const ret = wasm.prp_from_parameters(ptr0);
        return PRP.__wrap(ret);
    }
}

const PRPParametersFinalization = new FinalizationRegistry(ptr => wasm.__wbg_prpparameters_free(ptr >>> 0));
/**
* Parameters for the Pseudo-Random Permutation (PRP) function
* This consists of IV and the raw secret key for use by the underlying cryptographic transformation.
*/
export class PRPParameters {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PRPParameters.prototype);
        obj.__wbg_ptr = ptr;
        PRPParametersFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PRPParametersFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_prpparameters_free(ptr);
    }
    /**
    * @returns {Uint8Array}
    */
    key() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.prpparameters_key(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    iv() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.prpparameters_iv(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Creates new parameters for the PRP by expanding the given
    * keying material into the secret key and IV for the underlying cryptographic transformation.
    * @param {Uint8Array} secret
    */
    constructor(secret) {
        const ptr0 = passArray8ToWasm0(secret, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.prpparameters_new(ptr0, len0);
        return PRPParameters.__wrap(ret);
    }
}

const PassiveStrategyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_passivestrategy_free(ptr >>> 0));
/**
* Implements passive strategy which does nothing.
*/
export class PassiveStrategy {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PassiveStrategy.prototype);
        obj.__wbg_ptr = ptr;
        PassiveStrategyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PassiveStrategyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_passivestrategy_free(ptr);
    }
    /**
    */
    constructor() {
        const ret = wasm.passivestrategy__new();
        return PassiveStrategy.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.passivestrategy_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Balance} balance
    * @param {Iterator<any>} peer_ids
    * @param {any} outgoing_channels
    * @param {Function} quality_of
    * @returns {StrategyTickResult}
    */
    tick(balance, peer_ids, outgoing_channels, quality_of) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(balance, Balance);
            var ptr0 = balance.__destroy_into_raw();
            wasm.passivestrategy_tick(retptr, this.__wbg_ptr, ptr0, peer_ids, outgoing_channels, quality_of);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return StrategyTickResult.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const PendingAcknowledgementFinalization = new FinalizationRegistry(ptr => wasm.__wbg_pendingacknowledgement_free(ptr >>> 0));
/**
*/
export class PendingAcknowledgement {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PendingAcknowledgement.prototype);
        obj.__wbg_ptr = ptr;
        PendingAcknowledgementFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PendingAcknowledgementFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pendingacknowledgement_free(ptr);
    }
    /**
    * @param {boolean} is_sender
    * @param {UnacknowledgedTicket | undefined} ticket
    */
    constructor(is_sender, ticket) {
        let ptr0 = 0;
        if (!isLikeNone(ticket)) {
            _assertClass(ticket, UnacknowledgedTicket);
            ptr0 = ticket.__destroy_into_raw();
        }
        const ret = wasm.pendingacknowledgement_new(is_sender, ptr0);
        return PendingAcknowledgement.__wrap(ret);
    }
    /**
    * @returns {boolean}
    */
    is_msg_sender() {
        const ret = wasm.pendingacknowledgement_is_msg_sender(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {UnacknowledgedTicket | undefined}
    */
    ticket() {
        const ret = wasm.pendingacknowledgement_ticket(this.__wbg_ptr);
        return ret === 0 ? undefined : UnacknowledgedTicket.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {PendingAcknowledgement}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.pendingacknowledgement_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PendingAcknowledgement.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.pendingacknowledgement_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const PromiscuousStrategyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_promiscuousstrategy_free(ptr >>> 0));
/**
* Implements promiscuous strategy.
* This strategy opens outgoing channels to peers, which have quality above a given threshold.
* At the same time, it closes outgoing channels opened to peers whose quality dropped below this threshold.
*/
export class PromiscuousStrategy {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PromiscuousStrategy.prototype);
        obj.__wbg_ptr = ptr;
        PromiscuousStrategyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PromiscuousStrategyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_promiscuousstrategy_free(ptr);
    }
    /**
    */
    constructor() {
        const ret = wasm.promiscuousstrategy__new();
        return PromiscuousStrategy.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.promiscuousstrategy_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Balance} balance
    * @param {Iterator<any>} peer_ids
    * @param {any} outgoing_channels
    * @param {Function} quality_of
    * @returns {StrategyTickResult}
    */
    tick(balance, peer_ids, outgoing_channels, quality_of) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(balance, Balance);
            var ptr0 = balance.__destroy_into_raw();
            wasm.promiscuousstrategy_tick(retptr, this.__wbg_ptr, ptr0, peer_ids, outgoing_channels, quality_of);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return StrategyTickResult.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * A quality threshold between 0 and 1 used to determine whether the strategy should open channel with the peer.
    * Defaults to 0.5
    * @returns {number}
    */
    get network_quality_threshold() {
        const ret = wasm.__wbg_get_promiscuousstrategy_network_quality_threshold(this.__wbg_ptr);
        return ret;
    }
    /**
    * A quality threshold between 0 and 1 used to determine whether the strategy should open channel with the peer.
    * Defaults to 0.5
    * @param {number} arg0
    */
    set network_quality_threshold(arg0) {
        wasm.__wbg_set_promiscuousstrategy_network_quality_threshold(this.__wbg_ptr, arg0);
    }
    /**
    * A stake of tokens that should be allocated to a channel opened by the strategy.
    * Defaults to 0.1 HOPR
    * @returns {Balance}
    */
    get new_channel_stake() {
        const ret = wasm.__wbg_get_promiscuousstrategy_new_channel_stake(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * A stake of tokens that should be allocated to a channel opened by the strategy.
    * Defaults to 0.1 HOPR
    * @param {Balance} arg0
    */
    set new_channel_stake(arg0) {
        _assertClass(arg0, Balance);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_promiscuousstrategy_new_channel_stake(this.__wbg_ptr, ptr0);
    }
    /**
    * A minimum channel token stake. If reached, the channel will be closed and re-opened with `new_channel_stake`.
    * Defaults to 0.01 HOPR
    * @returns {Balance}
    */
    get minimum_channel_balance() {
        const ret = wasm.__wbg_get_promiscuousstrategy_minimum_channel_balance(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * A minimum channel token stake. If reached, the channel will be closed and re-opened with `new_channel_stake`.
    * Defaults to 0.01 HOPR
    * @param {Balance} arg0
    */
    set minimum_channel_balance(arg0) {
        _assertClass(arg0, Balance);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_promiscuousstrategy_minimum_channel_balance(this.__wbg_ptr, ptr0);
    }
    /**
    * Minimum token balance of the node. When reached, the strategy will not open any new channels.
    * Defaults to 0.01 HOPR
    * @returns {Balance}
    */
    get minimum_node_balance() {
        const ret = wasm.__wbg_get_promiscuousstrategy_minimum_node_balance(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * Minimum token balance of the node. When reached, the strategy will not open any new channels.
    * Defaults to 0.01 HOPR
    * @param {Balance} arg0
    */
    set minimum_node_balance(arg0) {
        _assertClass(arg0, Balance);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_promiscuousstrategy_minimum_node_balance(this.__wbg_ptr, ptr0);
    }
    /**
    * Maximum number of opened channels the strategy should maintain.
    * Defaults to square-root of the sampled network size.
    * @returns {number | undefined}
    */
    get max_channels() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_promiscuousstrategy_max_channels(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Maximum number of opened channels the strategy should maintain.
    * Defaults to square-root of the sampled network size.
    * @param {number | undefined} arg0
    */
    set max_channels(arg0) {
        wasm.__wbg_set_promiscuousstrategy_max_channels(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * Determines if the strategy should automatically redeem tickets.
    * Defaults to false
    * @returns {boolean}
    */
    get auto_redeem_tickets() {
        const ret = wasm.__wbg_get_promiscuousstrategy_auto_redeem_tickets(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * Determines if the strategy should automatically redeem tickets.
    * Defaults to false
    * @param {boolean} arg0
    */
    set auto_redeem_tickets(arg0) {
        wasm.__wbg_set_promiscuousstrategy_auto_redeem_tickets(this.__wbg_ptr, arg0);
    }
    /**
    * If set, the strategy will aggressively close channels (even with peers above the `network_quality_threshold`)
    * if the number of opened outgoing channels (regardless if opened by the strategy or manually) exceeds the
    * `max_channels` limit.
    * Defaults to true
    * @returns {boolean}
    */
    get enforce_max_channels() {
        const ret = wasm.__wbg_get_promiscuousstrategy_enforce_max_channels(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * If set, the strategy will aggressively close channels (even with peers above the `network_quality_threshold`)
    * if the number of opened outgoing channels (regardless if opened by the strategy or manually) exceeds the
    * `max_channels` limit.
    * Defaults to true
    * @param {boolean} arg0
    */
    set enforce_max_channels(arg0) {
        wasm.__wbg_set_promiscuousstrategy_enforce_max_channels(this.__wbg_ptr, arg0);
    }
}

const PublicKeyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_publickey_free(ptr >>> 0));
/**
* Represents a secp256k1 public key.
* This is a "Schrödinger public key", both compressed and uncompressed to save some cycles.
*/
export class PublicKey {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PublicKey.prototype);
        obj.__wbg_ptr = ptr;
        PublicKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PublicKeyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_publickey_free(ptr);
    }
    /**
    * Generates a new random public key.
    * Because the corresponding private key is discarded, this might be useful only for testing purposes.
    * @returns {PublicKey}
    */
    static random() {
        const ret = wasm.publickey_random();
        return PublicKey.__wrap(ret);
    }
    /**
    * Converts the public key to an Ethereum address
    * @returns {Address}
    */
    to_address() {
        const ret = wasm.publickey_to_address(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * Serializes the public key to a binary form.
    * @param {boolean} compressed
    * @returns {Uint8Array}
    */
    to_bytes(compressed) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.publickey_to_bytes(retptr, this.__wbg_ptr, compressed);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Serializes the public key to a binary form and converts it to hexadecimal string representation.
    * @param {boolean} compressed
    * @returns {string}
    */
    to_hex(compressed) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.publickey_to_hex(retptr, this.__wbg_ptr, compressed);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {KeyPair}
    */
    static random_keypair() {
        const ret = wasm.publickey_random_keypair();
        return KeyPair.__wrap(ret);
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {PublicKey}
    */
    static deserialize(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.publickey_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {boolean} compressed
    * @returns {Uint8Array}
    */
    serialize(compressed) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.publickey_serialize(retptr, this.__wbg_ptr, compressed);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {string} peer_id
    * @returns {PublicKey}
    */
    static from_peerid_str(peer_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(peer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.publickey_from_peerid_str(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_peerid_str() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.publickey_to_peerid_str(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Uint8Array} hash
    * @param {Uint8Array} r
    * @param {Uint8Array} s
    * @param {number} v
    * @returns {PublicKey}
    */
    static from_signature(hash, r, s, v) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(hash, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(r, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArray8ToWasm0(s, wasm.__wbindgen_malloc);
            const len2 = WASM_VECTOR_LEN;
            wasm.publickey_from_signature(retptr, ptr0, len0, ptr1, len1, ptr2, len2, v);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} private_key
    * @returns {PublicKey}
    */
    static from_privkey(private_key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.publickey_from_privkey(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {PublicKey} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, PublicKey);
        const ret = wasm.publickey_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {number}
    */
    static size_compressed() {
        const ret = wasm.challenge_size();
        return ret >>> 0;
    }
    /**
    * @returns {number}
    */
    static size_uncompressed() {
        const ret = wasm.curvepoint_size();
        return ret >>> 0;
    }
    /**
    * @returns {PublicKey}
    */
    clone() {
        const ret = wasm.publickey_clone(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
}

const RandomStrategyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_randomstrategy_free(ptr >>> 0));
/**
* Implements random strategy (cover traffic)
*/
export class RandomStrategy {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(RandomStrategy.prototype);
        obj.__wbg_ptr = ptr;
        RandomStrategyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RandomStrategyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_randomstrategy_free(ptr);
    }
    /**
    */
    constructor() {
        const ret = wasm.randomstrategy__new();
        return RandomStrategy.__wrap(ret);
    }
    /**
    * @returns {string}
    */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.randomstrategy_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Balance} balance
    * @param {Iterator<any>} peer_ids
    * @param {any} outgoing_channels
    * @param {Function} quality_of
    * @returns {StrategyTickResult}
    */
    tick(balance, peer_ids, outgoing_channels, quality_of) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(balance, Balance);
            var ptr0 = balance.__destroy_into_raw();
            wasm.randomstrategy_tick(retptr, this.__wbg_ptr, ptr0, peer_ids, outgoing_channels, quality_of);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return StrategyTickResult.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const ResolvedNetworkFinalization = new FinalizationRegistry(ptr => wasm.__wbg_resolvednetwork_free(ptr >>> 0));
/**
*/
export class ResolvedNetwork {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResolvedNetworkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_resolvednetwork_free(ptr);
    }
    /**
    * the network identifier, e.g. monte_rosa
    * @returns {string}
    */
    get id() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_resolvednetwork_id(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * the network identifier, e.g. monte_rosa
    * @param {string} arg0
    */
    set id(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_resolvednetwork_id(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {ChainOptions}
    */
    get chain() {
        const ret = wasm.__wbg_get_resolvednetwork_chain(this.__wbg_ptr);
        return ChainOptions.__wrap(ret);
    }
    /**
    * @param {ChainOptions} arg0
    */
    set chain(arg0) {
        _assertClass(arg0, ChainOptions);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_resolvednetwork_chain(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {number}
    */
    get environment_type() {
        const ret = wasm.__wbg_get_resolvednetwork_environment_type(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set environment_type(arg0) {
        wasm.__wbg_set_resolvednetwork_environment_type(this.__wbg_ptr, arg0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get channels_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_resolvednetwork_channels_contract_address(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set channels_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_resolvednetwork_channels_contract_address(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number}
    */
    get channel_contract_deploy_block() {
        const ret = wasm.__wbg_get_chainoptions_chain_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {number} arg0
    */
    set channel_contract_deploy_block(arg0) {
        wasm.__wbg_set_chainoptions_chain_id(this.__wbg_ptr, arg0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get token_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_id(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set token_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_id(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get xhopr_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_description(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set xhopr_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_description(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get boost_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_default_provider(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set boost_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_default_provider(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get stake_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_max_fee_per_gas(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set stake_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_max_fee_per_gas(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get network_registry_proxy_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_max_priority_fee_per_gas(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set network_registry_proxy_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_max_priority_fee_per_gas(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * an Ethereum address
    * @returns {string}
    */
    get network_registry_contract_address() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_chainoptions_native_token_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * an Ethereum address
    * @param {string} arg0
    */
    set network_registry_contract_address(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_chainoptions_native_token_name(this.__wbg_ptr, ptr0, len0);
    }
}

const ResponseFinalization = new FinalizationRegistry(ptr => wasm.__wbg_response_free(ptr >>> 0));
/**
* Contains a response upon ticket acknowledgement
* It is equivalent to a non-zero secret scalar on secp256k1 (EC private key).
*/
export class Response {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Response.prototype);
        obj.__wbg_ptr = ptr;
        ResponseFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ResponseFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_response_free(ptr);
    }
    /**
    * @param {Uint8Array} data
    */
    constructor(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.response_new(ptr0, len0);
        return Response.__wrap(ret);
    }
    /**
    * Converts this response to the PoR challenge by turning the non-zero scalar
    * represented by this response into a secp256k1 curve point (public key)
    * @returns {Challenge}
    */
    to_challenge() {
        const ret = wasm.response_to_challenge(this.__wbg_ptr);
        return Challenge.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {Response}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.response_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Response.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.response_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.response_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {HalfKey} first
    * @param {HalfKey} second
    * @returns {Response}
    */
    static from_half_keys(first, second) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(first, HalfKey);
            _assertClass(second, HalfKey);
            wasm.response_from_half_keys(retptr, first.__wbg_ptr, second.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Response.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Response}
    */
    clone() {
        const ret = wasm.response_clone(this.__wbg_ptr);
        return Response.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.halfkey_size();
        return ret >>> 0;
    }
}

const SharedKeysFinalization = new FinalizationRegistry(ptr => wasm.__wbg_sharedkeys_free(ptr >>> 0));
/**
* Structure containing shared keys for peers.
* The members are exposed only using specialized methods.
*/
export class SharedKeys {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SharedKeys.prototype);
        obj.__wbg_ptr = ptr;
        SharedKeysFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SharedKeysFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sharedkeys_free(ptr);
    }
    /**
    * Get the `alpha` value of the derived shared secrets.
    * @returns {Uint8Array}
    */
    get_alpha() {
        const ret = wasm.sharedkeys_get_alpha(this.__wbg_ptr);
        return ret;
    }
    /**
    * Gets the shared secret of the peer on the given index.
    * The indices are assigned in the same order as they were given to the
    * [`generate`] function.
    * @param {number} peer_idx
    * @returns {Uint8Array | undefined}
    */
    get_peer_shared_key(peer_idx) {
        const ret = wasm.sharedkeys_get_peer_shared_key(this.__wbg_ptr, peer_idx);
        return ret;
    }
    /**
    * Returns the number of shared keys generated in this structure.
    * @returns {number}
    */
    count_shared_keys() {
        const ret = wasm.sharedkeys_count_shared_keys(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @param {Uint8Array} alpha
    * @param {Uint8Array} private_key
    * @returns {SharedKeys}
    */
    static forward_transform(alpha, private_key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(alpha, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
            const len1 = WASM_VECTOR_LEN;
            wasm.sharedkeys_forward_transform(retptr, ptr0, len0, ptr1, len1);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return SharedKeys.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Generate shared keys given the peer public keys
    * @param {(Uint8Array)[]} peer_public_keys
    * @returns {SharedKeys}
    */
    static generate(peer_public_keys) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayJsValueToWasm0(peer_public_keys, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.sharedkeys_generate(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return SharedKeys.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const SignatureFinalization = new FinalizationRegistry(ptr => wasm.__wbg_signature_free(ptr >>> 0));
/**
* Represents an ECDSA signature based on the secp256k1 curve with recoverable public key.
* This signature encodes the 2-bit recovery information into the
* upper-most bits of MSB of the S value, which are never used by this ECDSA
* instantiation over secp256k1.
*/
export class Signature {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Signature.prototype);
        obj.__wbg_ptr = ptr;
        SignatureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SignatureFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_signature_free(ptr);
    }
    /**
    * @param {Uint8Array} raw_bytes
    * @param {number} recovery
    */
    constructor(raw_bytes, recovery) {
        const ptr0 = passArray8ToWasm0(raw_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.signature_new(ptr0, len0, recovery);
        return Signature.__wrap(ret);
    }
    /**
    * Signs the given message using the raw private key.
    * @param {Uint8Array} message
    * @param {Uint8Array} private_key
    * @returns {Signature}
    */
    static sign_message(message, private_key) {
        const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.signature_sign_message(ptr0, len0, ptr1, len1);
        return Signature.__wrap(ret);
    }
    /**
    * Signs the given hash using the raw private key.
    * @param {Uint8Array} hash
    * @param {Uint8Array} private_key
    * @returns {Signature}
    */
    static sign_hash(hash, private_key) {
        const ptr0 = passArray8ToWasm0(hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.signature_sign_hash(ptr0, len0, ptr1, len1);
        return Signature.__wrap(ret);
    }
    /**
    * Verifies this signature against the given message and a public key (compressed or uncompressed)
    * @param {Uint8Array} message
    * @param {Uint8Array} public_key
    * @returns {boolean}
    */
    verify_message(message, public_key) {
        const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.signature_verify_message(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret !== 0;
    }
    /**
    * Verifies this signature against the given message and a public key object
    * @param {Uint8Array} message
    * @param {PublicKey} public_key
    * @returns {boolean}
    */
    verify_message_with_pubkey(message, public_key) {
        const ptr0 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(public_key, PublicKey);
        const ret = wasm.signature_verify_message_with_pubkey(this.__wbg_ptr, ptr0, len0, public_key.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * Verifies this signature against the given hash and a public key (compressed or uncompressed)
    * @param {Uint8Array} hash
    * @param {Uint8Array} public_key
    * @returns {boolean}
    */
    verify_hash(hash, public_key) {
        const ptr0 = passArray8ToWasm0(hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.signature_verify_hash(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return ret !== 0;
    }
    /**
    * Verifies this signature against the given message and a public key object
    * @param {Uint8Array} hash
    * @param {PublicKey} public_key
    * @returns {boolean}
    */
    verify_hash_with_pubkey(hash, public_key) {
        const ptr0 = passArray8ToWasm0(hash, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(public_key, PublicKey);
        const ret = wasm.signature_verify_hash_with_pubkey(this.__wbg_ptr, ptr0, len0, public_key.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * Returns the raw signature, without the encoded public key recovery bit.
    * @returns {Uint8Array}
    */
    raw_signature() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.signature_raw_signature(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} signature
    * @returns {Signature}
    */
    static deserialize(signature) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.signature_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Signature.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.signature_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.signature_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Signature}
    */
    clone() {
        const ret = wasm.signature_clone(this.__wbg_ptr);
        return Signature.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.signature_size();
        return ret >>> 0;
    }
}

const SnapshotFinalization = new FinalizationRegistry(ptr => wasm.__wbg_snapshot_free(ptr >>> 0));
/**
* Represents a snapshot in the blockchain
*/
export class Snapshot {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Snapshot.prototype);
        obj.__wbg_ptr = ptr;
        SnapshotFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SnapshotFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_snapshot_free(ptr);
    }
    /**
    * @returns {U256}
    */
    get block_number() {
        const ret = wasm.__wbg_get_snapshot_block_number(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set block_number(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_snapshot_block_number(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get transaction_index() {
        const ret = wasm.__wbg_get_snapshot_transaction_index(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set transaction_index(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_snapshot_transaction_index(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get log_index() {
        const ret = wasm.__wbg_get_snapshot_log_index(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set log_index(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_snapshot_log_index(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {U256} block_number
    * @param {U256} transaction_index
    * @param {U256} log_index
    */
    constructor(block_number, transaction_index, log_index) {
        _assertClass(block_number, U256);
        var ptr0 = block_number.__destroy_into_raw();
        _assertClass(transaction_index, U256);
        var ptr1 = transaction_index.__destroy_into_raw();
        _assertClass(log_index, U256);
        var ptr2 = log_index.__destroy_into_raw();
        const ret = wasm.snapshot_new(ptr0, ptr1, ptr2);
        return Snapshot.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {Snapshot}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.snapshot_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Snapshot.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.snapshot_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Snapshot}
    */
    clone() {
        const ret = wasm.snapshot_clone(this.__wbg_ptr);
        return Snapshot.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.snapshot_size();
        return ret >>> 0;
    }
}

const StrategyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_strategy_free(ptr >>> 0));
/**
*/
export class Strategy {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Strategy.prototype);
        obj.__wbg_ptr = ptr;
        StrategyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrategyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strategy_free(ptr);
    }
    /**
    * @returns {string}
    */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_strategy_name(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {string} arg0
    */
    set name(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_strategy_name(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * @returns {number | undefined}
    */
    get max_auto_channels() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.__wbg_get_strategy_max_auto_channels(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            return r0 === 0 ? undefined : r1 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number | undefined} arg0
    */
    set max_auto_channels(arg0) {
        wasm.__wbg_set_strategy_max_auto_channels(this.__wbg_ptr, !isLikeNone(arg0), isLikeNone(arg0) ? 0 : arg0);
    }
    /**
    * @returns {boolean}
    */
    get auto_redeem_tickets() {
        const ret = wasm.__wbg_get_strategy_auto_redeem_tickets(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set auto_redeem_tickets(arg0) {
        wasm.__wbg_set_strategy_auto_redeem_tickets(this.__wbg_ptr, arg0);
    }
}

const StrategyTickResultFinalization = new FinalizationRegistry(ptr => wasm.__wbg_strategytickresult_free(ptr >>> 0));
/**
*/
export class StrategyTickResult {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StrategyTickResult.prototype);
        obj.__wbg_ptr = ptr;
        StrategyTickResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StrategyTickResultFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_strategytickresult_free(ptr);
    }
    /**
    * @param {number} max_auto_channels
    * @param {any} to_open
    * @param {(string)[]} to_close
    */
    constructor(max_auto_channels, to_open, to_close) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayJsValueToWasm0(to_close, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.strategytickresult_new(retptr, max_auto_channels, to_open, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return StrategyTickResult.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {number}
    */
    get max_auto_channels() {
        const ret = wasm.strategytickresult_max_auto_channels(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {any}
    */
    to_open() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.strategytickresult_to_open(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return takeFromExternrefTable0(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {(string)[]}
    */
    to_close() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.strategytickresult_to_close(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayJsValueFromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const TestingFinalization = new FinalizationRegistry(ptr => wasm.__wbg_testing_free(ptr >>> 0));
/**
*/
export class Testing {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Testing.prototype);
        obj.__wbg_ptr = ptr;
        TestingFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TestingFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_testing_free(ptr);
    }
    /**
    * @returns {boolean}
    */
    get announce_local_addresses() {
        const ret = wasm.__wbg_get_testing_announce_local_addresses(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set announce_local_addresses(arg0) {
        wasm.__wbg_set_testing_announce_local_addresses(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get prefer_local_addresses() {
        const ret = wasm.__wbg_get_testing_prefer_local_addresses(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set prefer_local_addresses(arg0) {
        wasm.__wbg_set_testing_prefer_local_addresses(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get use_weak_crypto() {
        const ret = wasm.__wbg_get_testing_use_weak_crypto(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set use_weak_crypto(arg0) {
        wasm.__wbg_set_testing_use_weak_crypto(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get no_direct_connections() {
        const ret = wasm.__wbg_get_testing_no_direct_connections(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set no_direct_connections(arg0) {
        wasm.__wbg_set_testing_no_direct_connections(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get no_webrtc_upgrade() {
        const ret = wasm.__wbg_get_testing_no_webrtc_upgrade(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set no_webrtc_upgrade(arg0) {
        wasm.__wbg_set_testing_no_webrtc_upgrade(this.__wbg_ptr, arg0);
    }
    /**
    * @returns {boolean}
    */
    get local_mode_stun() {
        const ret = wasm.__wbg_get_testing_local_mode_stun(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {boolean} arg0
    */
    set local_mode_stun(arg0) {
        wasm.__wbg_set_testing_local_mode_stun(this.__wbg_ptr, arg0);
    }
}

const TicketFinalization = new FinalizationRegistry(ptr => wasm.__wbg_ticket_free(ptr >>> 0));
/**
* Contains the overall description of a ticket with a signature
*/
export class Ticket {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Ticket.prototype);
        obj.__wbg_ptr = ptr;
        TicketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TicketFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ticket_free(ptr);
    }
    /**
    * @returns {Address}
    */
    get counterparty() {
        const ret = wasm.__wbg_get_ticket_counterparty(this.__wbg_ptr);
        return Address.__wrap(ret);
    }
    /**
    * @param {Address} arg0
    */
    set counterparty(arg0) {
        _assertClass(arg0, Address);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_ticket_counterparty(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {EthereumChallenge}
    */
    get challenge() {
        const ret = wasm.__wbg_get_ticket_challenge(this.__wbg_ptr);
        return EthereumChallenge.__wrap(ret);
    }
    /**
    * @param {EthereumChallenge} arg0
    */
    set challenge(arg0) {
        _assertClass(arg0, EthereumChallenge);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_ticket_challenge(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get epoch() {
        const ret = wasm.__wbg_get_ticket_epoch(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set epoch(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_ticket_epoch(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get index() {
        const ret = wasm.__wbg_get_channelentry_ticket_epoch(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set index(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_ticket_epoch(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Balance}
    */
    get amount() {
        const ret = wasm.__wbg_get_ticket_amount(this.__wbg_ptr);
        return Balance.__wrap(ret);
    }
    /**
    * @param {Balance} arg0
    */
    set amount(arg0) {
        _assertClass(arg0, Balance);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_ticket_amount(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get win_prob() {
        const ret = wasm.__wbg_get_channelentry_ticket_index(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set win_prob(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_ticket_index(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {U256}
    */
    get channel_epoch() {
        const ret = wasm.__wbg_get_channelentry_channel_epoch(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @param {U256} arg0
    */
    set channel_epoch(arg0) {
        _assertClass(arg0, U256);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_channelentry_channel_epoch(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {Signature | undefined}
    */
    get signature() {
        const ret = wasm.__wbg_get_ticket_signature(this.__wbg_ptr);
        return ret === 0 ? undefined : Signature.__wrap(ret);
    }
    /**
    * @param {Signature | undefined} arg0
    */
    set signature(arg0) {
        let ptr0 = 0;
        if (!isLikeNone(arg0)) {
            _assertClass(arg0, Signature);
            ptr0 = arg0.__destroy_into_raw();
        }
        wasm.__wbg_set_ticket_signature(this.__wbg_ptr, ptr0);
    }
    /**
    * Creates a new Ticket given the raw Challenge and signs it using the given key.
    * @param {Address} counterparty
    * @param {U256} epoch
    * @param {U256} index
    * @param {Balance} amount
    * @param {U256} win_prob
    * @param {U256} channel_epoch
    * @param {Uint8Array} signing_key
    * @returns {Ticket}
    */
    static new(counterparty, epoch, index, amount, win_prob, channel_epoch, signing_key) {
        _assertClass(counterparty, Address);
        var ptr0 = counterparty.__destroy_into_raw();
        _assertClass(epoch, U256);
        var ptr1 = epoch.__destroy_into_raw();
        _assertClass(index, U256);
        var ptr2 = index.__destroy_into_raw();
        _assertClass(amount, Balance);
        var ptr3 = amount.__destroy_into_raw();
        _assertClass(win_prob, U256);
        var ptr4 = win_prob.__destroy_into_raw();
        _assertClass(channel_epoch, U256);
        var ptr5 = channel_epoch.__destroy_into_raw();
        const ptr6 = passArray8ToWasm0(signing_key, wasm.__wbindgen_malloc);
        const len6 = WASM_VECTOR_LEN;
        const ret = wasm.ticket_new(ptr0, ptr1, ptr2, ptr3, ptr4, ptr5, ptr6, len6);
        return Ticket.__wrap(ret);
    }
    /**
    * @param {EthereumChallenge} challenge
    * @param {Uint8Array} signing_key
    */
    set_challenge(challenge, signing_key) {
        _assertClass(challenge, EthereumChallenge);
        var ptr0 = challenge.__destroy_into_raw();
        const ptr1 = passArray8ToWasm0(signing_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.ticket_set_challenge(this.__wbg_ptr, ptr0, ptr1, len1);
    }
    /**
    * Signs the ticket using the given private key.
    * @param {Uint8Array} signing_key
    */
    sign(signing_key) {
        const ptr0 = passArray8ToWasm0(signing_key, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.ticket_sign(this.__wbg_ptr, ptr0, len0);
    }
    /**
    * Convenience method for creating a zero-hop ticket
    * @param {PublicKey} destination
    * @param {Uint8Array} private_key
    * @returns {Ticket}
    */
    static new_zero_hop(destination, private_key) {
        _assertClass(destination, PublicKey);
        var ptr0 = destination.__destroy_into_raw();
        const ptr1 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.ticket_new_zero_hop(ptr0, ptr1, len1);
        return Ticket.__wrap(ret);
    }
    /**
    * Serializes the ticket except the signature
    * @returns {Uint8Array}
    */
    serialize_unsigned() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ticket_serialize_unsigned(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * Computes Ethereum signature hash of the ticket
    * @returns {Hash}
    */
    get_hash() {
        const ret = wasm.ticket_get_hash(this.__wbg_ptr);
        return Hash.__wrap(ret);
    }
    /**
    * Computes a candidate check value to verify if this ticket is winning
    * @param {Hash} preimage
    * @param {Response} channel_response
    * @returns {U256}
    */
    get_luck(preimage, channel_response) {
        _assertClass(preimage, Hash);
        _assertClass(channel_response, Response);
        const ret = wasm.ticket_get_luck(this.__wbg_ptr, preimage.__wbg_ptr, channel_response.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * Decides whether a ticket is a win or not.
    * Note that this mimics the on-chain logic.
    * Purpose of the function is to check the validity of ticket before we submit it to the blockchain.
    * @param {Hash} preimage
    * @param {Response} channel_response
    * @param {U256} win_prob
    * @returns {boolean}
    */
    is_winning(preimage, channel_response, win_prob) {
        _assertClass(preimage, Hash);
        _assertClass(channel_response, Response);
        _assertClass(win_prob, U256);
        var ptr0 = win_prob.__destroy_into_raw();
        const ret = wasm.ticket_is_winning(this.__wbg_ptr, preimage.__wbg_ptr, channel_response.__wbg_ptr, ptr0);
        return ret !== 0;
    }
    /**
    * Based on the price of this ticket, determines the path position (hop number) this ticket
    * relates to.
    * @param {U256} price_per_packet
    * @param {U256} inverse_ticket_win_prob
    * @returns {number}
    */
    get_path_position(price_per_packet, inverse_ticket_win_prob) {
        _assertClass(price_per_packet, U256);
        var ptr0 = price_per_packet.__destroy_into_raw();
        _assertClass(inverse_ticket_win_prob, U256);
        var ptr1 = inverse_ticket_win_prob.__destroy_into_raw();
        const ret = wasm.ticket_get_path_position(this.__wbg_ptr, ptr0, ptr1);
        return ret;
    }
    /**
    * @param {Address} counterparty
    * @param {EthereumChallenge} challenge
    * @param {U256} epoch
    * @param {U256} index
    * @param {Balance} amount
    * @param {U256} win_prob
    * @param {U256} channel_epoch
    * @param {Signature} signature
    */
    constructor(counterparty, challenge, epoch, index, amount, win_prob, channel_epoch, signature) {
        _assertClass(counterparty, Address);
        var ptr0 = counterparty.__destroy_into_raw();
        _assertClass(challenge, EthereumChallenge);
        var ptr1 = challenge.__destroy_into_raw();
        _assertClass(epoch, U256);
        var ptr2 = epoch.__destroy_into_raw();
        _assertClass(index, U256);
        var ptr3 = index.__destroy_into_raw();
        _assertClass(amount, Balance);
        var ptr4 = amount.__destroy_into_raw();
        _assertClass(win_prob, U256);
        var ptr5 = win_prob.__destroy_into_raw();
        _assertClass(channel_epoch, U256);
        var ptr6 = channel_epoch.__destroy_into_raw();
        _assertClass(signature, Signature);
        var ptr7 = signature.__destroy_into_raw();
        const ret = wasm.ticket__new(ptr0, ptr1, ptr2, ptr3, ptr4, ptr5, ptr6, ptr7);
        return Ticket.__wrap(ret);
    }
    /**
    * @returns {PublicKey}
    */
    recover_signer() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ticket_recover_signer(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return PublicKey.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {PublicKey} public_key
    * @returns {boolean}
    */
    verify(public_key) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(public_key, PublicKey);
            wasm.ticket_verify(retptr, this.__wbg_ptr, public_key.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {Uint8Array} bytes
    * @returns {Ticket}
    */
    static deserialize(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.ticket_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Ticket.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ticket_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.ticket_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {Ticket} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, Ticket);
        const ret = wasm.ticket_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {Ticket}
    */
    clone() {
        const ret = wasm.ticket_clone(this.__wbg_ptr);
        return Ticket.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.ticket_size();
        return ret >>> 0;
    }
}

const U256Finalization = new FinalizationRegistry(ptr => wasm.__wbg_u256_free(ptr >>> 0));
/**
* Represents the Ethereum's basic numeric type - unsigned 256-bit integer
*/
export class U256 {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(U256.prototype);
        obj.__wbg_ptr = ptr;
        U256Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        U256Finalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_u256_free(ptr);
    }
    /**
    * @param {string} value
    */
    constructor(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.u256_new(ptr0, len0);
        return U256.__wrap(ret);
    }
    /**
    * @returns {U256}
    */
    static zero() {
        const ret = wasm.u256_zero();
        return U256.__wrap(ret);
    }
    /**
    * @returns {U256}
    */
    static one() {
        const ret = wasm.u256_one();
        return U256.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    as_u32() {
        const ret = wasm.u256_as_u32(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
    * @returns {bigint}
    */
    as_u64() {
        const ret = wasm.u256_as_u64(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
    * @param {number} n
    * @returns {U256}
    */
    addn(n) {
        const ret = wasm.u256_addn(this.__wbg_ptr, n);
        return U256.__wrap(ret);
    }
    /**
    * @param {number} n
    * @returns {U256}
    */
    muln(n) {
        const ret = wasm.u256_muln(this.__wbg_ptr, n);
        return U256.__wrap(ret);
    }
    /**
    * @param {number} value
    * @returns {U256}
    */
    static from(value) {
        const ret = wasm.u256_from(value);
        return U256.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {U256}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.u256_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return U256.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.u256_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_hex() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.u256_to_hex(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {U256} inverse_prob
    * @returns {U256}
    */
    static from_inverse_probability(inverse_prob) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(inverse_prob, U256);
            wasm.u256_from_inverse_probability(retptr, inverse_prob.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return U256.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {string}
    */
    to_string() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.u256_to_string(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1);
        }
    }
    /**
    * @param {U256} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, U256);
        const ret = wasm.u256_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @param {U256} other
    * @returns {number}
    */
    cmp(other) {
        _assertClass(other, U256);
        const ret = wasm.u256_cmp(this.__wbg_ptr, other.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {U256}
    */
    clone() {
        const ret = wasm.u256_clone(this.__wbg_ptr);
        return U256.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.balance_size();
        return ret >>> 0;
    }
}

const UnacknowledgedTicketFinalization = new FinalizationRegistry(ptr => wasm.__wbg_unacknowledgedticket_free(ptr >>> 0));
/**
* Wrapper for an unacknowledged ticket
*/
export class UnacknowledgedTicket {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(UnacknowledgedTicket.prototype);
        obj.__wbg_ptr = ptr;
        UnacknowledgedTicketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        UnacknowledgedTicketFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_unacknowledgedticket_free(ptr);
    }
    /**
    * @returns {Ticket}
    */
    get ticket() {
        const ret = wasm.__wbg_get_unacknowledgedticket_ticket(this.__wbg_ptr);
        return Ticket.__wrap(ret);
    }
    /**
    * @param {Ticket} arg0
    */
    set ticket(arg0) {
        _assertClass(arg0, Ticket);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_unacknowledgedticket_ticket(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {HalfKey}
    */
    get own_key() {
        const ret = wasm.__wbg_get_unacknowledgedticket_own_key(this.__wbg_ptr);
        return HalfKey.__wrap(ret);
    }
    /**
    * @param {HalfKey} arg0
    */
    set own_key(arg0) {
        _assertClass(arg0, HalfKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_unacknowledgedticket_own_key(this.__wbg_ptr, ptr0);
    }
    /**
    * @returns {PublicKey}
    */
    get signer() {
        const ret = wasm.__wbg_get_unacknowledgedticket_signer(this.__wbg_ptr);
        return PublicKey.__wrap(ret);
    }
    /**
    * @param {PublicKey} arg0
    */
    set signer(arg0) {
        _assertClass(arg0, PublicKey);
        var ptr0 = arg0.__destroy_into_raw();
        wasm.__wbg_set_unacknowledgedticket_signer(this.__wbg_ptr, ptr0);
    }
    /**
    * @param {Ticket} ticket
    * @param {HalfKey} own_key
    * @param {PublicKey} signer
    */
    constructor(ticket, own_key, signer) {
        _assertClass(ticket, Ticket);
        var ptr0 = ticket.__destroy_into_raw();
        _assertClass(own_key, HalfKey);
        var ptr1 = own_key.__destroy_into_raw();
        _assertClass(signer, PublicKey);
        var ptr2 = signer.__destroy_into_raw();
        const ret = wasm.unacknowledgedticket_new(ptr0, ptr1, ptr2);
        return UnacknowledgedTicket.__wrap(ret);
    }
    /**
    * @returns {HalfKeyChallenge}
    */
    get_challenge() {
        const ret = wasm.unacknowledgedticket_get_challenge(this.__wbg_ptr);
        return HalfKeyChallenge.__wrap(ret);
    }
    /**
    * @param {Uint8Array} data
    * @returns {UnacknowledgedTicket}
    */
    static deserialize(data) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
            const len0 = WASM_VECTOR_LEN;
            wasm.unacknowledgedticket_deserialize(retptr, ptr0, len0);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return UnacknowledgedTicket.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @returns {Uint8Array}
    */
    serialize() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.unacknowledgedticket_serialize(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {HalfKey} acknowledgement
    * @returns {Response}
    */
    get_response(acknowledgement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(acknowledgement, HalfKey);
            wasm.unacknowledgedticket_get_response(retptr, this.__wbg_ptr, acknowledgement.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return Response.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {HalfKey} acknowledgement
    * @returns {boolean}
    */
    verify_challenge(acknowledgement) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(acknowledgement, HalfKey);
            wasm.unacknowledgedticket_verify_challenge(retptr, this.__wbg_ptr, acknowledgement.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var r2 = getInt32Memory0()[retptr / 4 + 2];
            if (r2) {
                throw takeFromExternrefTable0(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {UnacknowledgedTicket} other
    * @returns {boolean}
    */
    eq(other) {
        _assertClass(other, UnacknowledgedTicket);
        const ret = wasm.unacknowledgedticket_eq(this.__wbg_ptr, other.__wbg_ptr);
        return ret !== 0;
    }
    /**
    * @returns {UnacknowledgedTicket}
    */
    clone() {
        const ret = wasm.unacknowledgedticket_clone(this.__wbg_ptr);
        return UnacknowledgedTicket.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    static size() {
        const ret = wasm.acknowledgedticket_size();
        return ret >>> 0;
    }
}

const WasmVecAccountEntryFinalization = new FinalizationRegistry(ptr => wasm.__wbg_wasmvecaccountentry_free(ptr >>> 0));
/**
*/
export class WasmVecAccountEntry {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmVecAccountEntry.prototype);
        obj.__wbg_ptr = ptr;
        WasmVecAccountEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVecAccountEntryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvecaccountentry_free(ptr);
    }
    /**
    * @returns {AccountEntry | undefined}
    */
    next() {
        const ret = wasm.wasmvecaccountentry_next(this.__wbg_ptr);
        return ret === 0 ? undefined : AccountEntry.__wrap(ret);
    }
}

const WasmVecAcknowledgedTicketFinalization = new FinalizationRegistry(ptr => wasm.__wbg_wasmvecacknowledgedticket_free(ptr >>> 0));
/**
*/
export class WasmVecAcknowledgedTicket {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmVecAcknowledgedTicket.prototype);
        obj.__wbg_ptr = ptr;
        WasmVecAcknowledgedTicketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVecAcknowledgedTicketFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvecacknowledgedticket_free(ptr);
    }
    /**
    * @returns {AcknowledgedTicket | undefined}
    */
    next() {
        const ret = wasm.wasmvecacknowledgedticket_next(this.__wbg_ptr);
        return ret === 0 ? undefined : AcknowledgedTicket.__wrap(ret);
    }
}

const WasmVecChannelEntryFinalization = new FinalizationRegistry(ptr => wasm.__wbg_wasmvecchannelentry_free(ptr >>> 0));
/**
*/
export class WasmVecChannelEntry {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmVecChannelEntry.prototype);
        obj.__wbg_ptr = ptr;
        WasmVecChannelEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVecChannelEntryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvecchannelentry_free(ptr);
    }
    /**
    * @returns {ChannelEntry | undefined}
    */
    next() {
        const ret = wasm.wasmvecchannelentry_next(this.__wbg_ptr);
        return ret === 0 ? undefined : ChannelEntry.__wrap(ret);
    }
}

const WasmVecPublicKeyFinalization = new FinalizationRegistry(ptr => wasm.__wbg_wasmvecpublickey_free(ptr >>> 0));
/**
*/
export class WasmVecPublicKey {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmVecPublicKey.prototype);
        obj.__wbg_ptr = ptr;
        WasmVecPublicKeyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmVecPublicKeyFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmvecpublickey_free(ptr);
    }
    /**
    * @returns {PublicKey | undefined}
    */
    next() {
        const ret = wasm.wasmvecpublickey_next(this.__wbg_ptr);
        return ret === 0 ? undefined : PublicKey.__wrap(ret);
    }
}

export function __wbindgen_is_undefined(arg0) {
    const ret = arg0 === undefined;
    return ret;
};

export function __wbindgen_in(arg0, arg1) {
    const ret = arg0 in arg1;
    return ret;
};

export function __wbindgen_number_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
    getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
};

export function __wbindgen_boolean_get(arg0) {
    const v = arg0;
    const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
    return ret;
};

export function __wbindgen_is_object(arg0) {
    const val = arg0;
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
};

export function __wbindgen_string_new(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
};

export function __wbindgen_string_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
};

export function __wbindgen_number_new(arg0) {
    const ret = arg0;
    return ret;
};

export function __wbindgen_is_null(arg0) {
    const ret = arg0 === null;
    return ret;
};

export function __wbg_intermediate_new(arg0) {
    const ret = Intermediate.__wrap(arg0);
    return ret;
};

export function __wbg_hash_new(arg0) {
    const ret = Hash.__wrap(arg0);
    return ret;
};

export function __wbg_log_da1bf4485742be52(arg0, arg1) {
    console.log(getStringFromWasm0(arg0, arg1));
};

export function __wbg_randomFillSync_e950366c42764a07() { return handleError(function (arg0, arg1) {
    arg0.randomFillSync(arg1);
}, arguments) };

export function __wbg_getRandomValues_3774744e221a22ad() { return handleError(function (arg0, arg1) {
    arg0.getRandomValues(arg1);
}, arguments) };

export function __wbg_crypto_70a96de3b6b73dac(arg0) {
    const ret = arg0.crypto;
    return ret;
};

export function __wbg_process_dd1577445152112e(arg0) {
    const ret = arg0.process;
    return ret;
};

export function __wbg_versions_58036bec3add9e6f(arg0) {
    const ret = arg0.versions;
    return ret;
};

export function __wbg_node_6a9d28205ed5b0d8(arg0) {
    const ret = arg0.node;
    return ret;
};

export function __wbindgen_is_string(arg0) {
    const ret = typeof(arg0) === 'string';
    return ret;
};

export function __wbg_require_f05d779769764e82() { return handleError(function () {
    const ret = module.require;
    return ret;
}, arguments) };

export function __wbg_msCrypto_adbc770ec9eca9c7(arg0) {
    const ret = arg0.msCrypto;
    return ret;
};

export function __wbg_new_abda76e883ba8a5f() {
    const ret = new Error();
    return ret;
};

export function __wbg_stack_658279fe44541cf6(arg0, arg1) {
    const ret = arg1.stack;
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
};

export function __wbg_error_f851667af71bcfc6(arg0, arg1) {
    let deferred0_0;
    let deferred0_1;
    try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
    } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1);
    }
};

export function __wbindgen_cb_drop(arg0) {
    const obj = arg0.original;
    if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
    }
    const ret = false;
    return ret;
};

export function __wbindgen_jsval_loose_eq(arg0, arg1) {
    const ret = arg0 == arg1;
    return ret;
};

export function __wbg_getwithrefkey_5e6d9547403deab8(arg0, arg1) {
    const ret = arg0[arg1];
    return ret;
};

export function __wbg_set_841ac57cff3d672b(arg0, arg1, arg2) {
    arg0[arg1] = arg2;
};

export function __wbg_String_88810dfeb4021902(arg0, arg1) {
    const ret = String(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
};

export function __wbindgen_error_new(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_get_7303ed2ef026b2f5(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
};

export function __wbg_length_820c786973abdd8a(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_new_0394642eae39db16() {
    const ret = new Array();
    return ret;
};

export function __wbindgen_is_function(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
};

export function __wbg_newnoargs_c9e6043b8ad84109(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_next_f4bc0e96ea67da68(arg0) {
    const ret = arg0.next;
    return ret;
};

export function __wbg_next_ec061e48a0e72a96() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments) };

export function __wbg_done_b6abb27d42b63867(arg0) {
    const ret = arg0.done;
    return ret;
};

export function __wbg_value_2f4ef2036bfad28e(arg0) {
    const ret = arg0.value;
    return ret;
};

export function __wbg_iterator_7c7e58f62eb84700() {
    const ret = Symbol.iterator;
    return ret;
};

export function __wbg_get_f53c921291c381bd() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_call_557a2f2deacc4912() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments) };

export function __wbg_new_2b6fea4ea03b1b95() {
    const ret = new Object();
    return ret;
};

export function __wbg_self_742dd6eab3e9211e() { return handleError(function () {
    const ret = self.self;
    return ret;
}, arguments) };

export function __wbg_window_c409e731db53a0e2() { return handleError(function () {
    const ret = window.window;
    return ret;
}, arguments) };

export function __wbg_globalThis_b70c095388441f2d() { return handleError(function () {
    const ret = globalThis.globalThis;
    return ret;
}, arguments) };

export function __wbg_global_1c72617491ed7194() { return handleError(function () {
    const ret = global.global;
    return ret;
}, arguments) };

export function __wbg_set_b4da98d504ac6091(arg0, arg1, arg2) {
    arg0[arg1 >>> 0] = arg2;
};

export function __wbg_from_6bc98a09a0b58bb1(arg0) {
    const ret = Array.from(arg0);
    return ret;
};

export function __wbg_isArray_04e59fb73f78ab5b(arg0) {
    const ret = Array.isArray(arg0);
    return ret;
};

export function __wbg_push_109cfc26d02582dd(arg0, arg1) {
    const ret = arg0.push(arg1);
    return ret;
};

export function __wbg_instanceof_ArrayBuffer_ef2632aa0d4bfff8(arg0) {
    let result;
    try {
        result = arg0 instanceof ArrayBuffer;
    } catch {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_call_587b30eea3e09332() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments) };

export function __wbg_next_0250e94a9243cb8b() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments) };

export function __wbg_isSafeInteger_2088b01008075470(arg0) {
    const ret = Number.isSafeInteger(arg0);
    return ret;
};

export function __wbg_new0_494c19a27871d56f() {
    const ret = new Date();
    return ret;
};

export function __wbg_now_c857fb0367c762cc() {
    const ret = Date.now();
    return ret;
};

export function __wbg_toISOString_9970f74228c1a802(arg0) {
    const ret = arg0.toISOString();
    return ret;
};

export function __wbg_entries_13e011453776468f(arg0) {
    const ret = Object.entries(arg0);
    return ret;
};

export function __wbg_new_2b55e405e4af4986(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return __wbg_adapter_671(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = state0.b = 0;
    }
};

export function __wbg_resolve_ae38ad63c43ff98b(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
};

export function __wbg_then_8df675b8bb5d5e3c(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
};

export function __wbg_then_835b073a479138e5(arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
};

export function __wbg_buffer_55ba7a6b1b92e2ac(arg0) {
    const ret = arg0.buffer;
    return ret;
};

export function __wbg_newwithbyteoffsetandlength_88d1d8be5df94b9b(arg0, arg1, arg2) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
};

export function __wbg_new_09938a7d020f049b(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
};

export function __wbg_set_3698e3ca519b3c3c(arg0, arg1, arg2) {
    arg0.set(arg1, arg2 >>> 0);
};

export function __wbg_length_0aab7ffd65ad19ed(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_instanceof_Uint8Array_1349640af2da2e88(arg0) {
    let result;
    try {
        result = arg0 instanceof Uint8Array;
    } catch {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_newwithlength_89eeca401d8918c2(arg0) {
    const ret = new Uint8Array(arg0 >>> 0);
    return ret;
};

export function __wbg_subarray_d82be056deb4ad27(arg0, arg1, arg2) {
    const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
    return ret;
};

export function __wbg_readfile_5be469bf534f98cf() { return handleError(function (arg0, arg1, arg2) {
    const ret = read_file(getStringFromWasm0(arg1, arg2));
    const ptr1 = passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
}, arguments) };

export function __wbg_coerceversion_698f5435d36d8e7f() { return handleError(function (arg0, arg1, arg2) {
    const ret = coerce_version(getStringFromWasm0(arg1, arg2));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
}, arguments) };

export function __wbg_satisfies_66483216a92cd1b3() { return handleError(function (arg0, arg1, arg2, arg3) {
    const ret = satisfies(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
    return ret;
}, arguments) };

export function __wbindgen_debug_string(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return ret;
};

export function __wbg_wasmvecaccountentry_new(arg0) {
    const ret = WasmVecAccountEntry.__wrap(arg0);
    return ret;
};

export function __wbg_wasmvecchannelentry_new(arg0) {
    const ret = WasmVecChannelEntry.__wrap(arg0);
    return ret;
};

export function __wbg_wasmvecpublickey_new(arg0) {
    const ret = WasmVecPublicKey.__wrap(arg0);
    return ret;
};

export function __wbg_wasmvecacknowledgedticket_new(arg0) {
    const ret = WasmVecAcknowledgedTicket.__wrap(arg0);
    return ret;
};

export function __wbg_address_new(arg0) {
    const ret = Address.__wrap(arg0);
    return ret;
};

export function __wbg_balance_new(arg0) {
    const ret = Balance.__wrap(arg0);
    return ret;
};

export function __wbg_snapshot_new(arg0) {
    const ret = Snapshot.__wrap(arg0);
    return ret;
};

export function __wbg_accountentry_new(arg0) {
    const ret = AccountEntry.__wrap(arg0);
    return ret;
};

export function __wbg_channelentry_new(arg0) {
    const ret = ChannelEntry.__wrap(arg0);
    return ret;
};

export function __wbg_get_005077d283063015() { return handleError(function (arg0, arg1, arg2) {
    var v0 = getArrayU8FromWasm0(arg1, arg2).slice();
    wasm.__wbindgen_free(arg1, arg2 * 1);
    const ret = arg0.get(v0);
    return ret;
}, arguments) };

export function __wbg_put_1881024354c948e2() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    var v0 = getArrayU8FromWasm0(arg1, arg2).slice();
    wasm.__wbindgen_free(arg1, arg2 * 1);
    var v1 = getArrayU8FromWasm0(arg3, arg4).slice();
    wasm.__wbindgen_free(arg3, arg4 * 1);
    const ret = arg0.put(v0, v1);
    return ret;
}, arguments) };

export function __wbg_has_d90867e5f41bfe90() { return handleError(function (arg0, arg1, arg2) {
    var v0 = getArrayU8FromWasm0(arg1, arg2).slice();
    wasm.__wbindgen_free(arg1, arg2 * 1);
    const ret = arg0.has(v0);
    return ret;
}, arguments) };

export function __wbg_remove_5cac78ae13d2bb21() { return handleError(function (arg0, arg1, arg2) {
    var v0 = getArrayU8FromWasm0(arg1, arg2).slice();
    wasm.__wbindgen_free(arg1, arg2 * 1);
    const ret = arg0.remove(v0);
    return ret;
}, arguments) };

export function __wbg_iterValues_cc9c403a8a275818() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.iterValues(arg1, arg2 >>> 0);
    return ret;
}, arguments) };

export function __wbg_batch_adf7f36420579ffb() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.batch(arg1, arg2 !== 0);
    return ret;
}, arguments) };

export const __wbg_clearTimeout_76877dbc010e786d = typeof clearTimeout == 'function' ? clearTimeout : notDefined('clearTimeout');

export function __wbg_setTimeout_75cb9b6991a4031d() { return handleError(function (arg0, arg1) {
    const ret = setTimeout(arg0, arg1);
    return ret;
}, arguments) };

export function __wbindgen_closure_wrapper3688(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 566, __wbg_adapter_42);
    return ret;
};

export function __wbindgen_closure_wrapper6128(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 844, __wbg_adapter_45);
    return ret;
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_2;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

