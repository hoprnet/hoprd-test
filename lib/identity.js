import { privKeyToPeerId, serializeKeyPair, deserializeKeyPair } from '@hoprnet/hopr-utils';
import { randomBytes } from 'crypto';
import { writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import { debug } from '@hoprnet/hopr-utils';
const log = debug(`hoprd:identity`);
export var IdentityErrors;
(function (IdentityErrors) {
    IdentityErrors["FAIL_TO_LOAD_IDENTITY"] = "Could not load identity";
    IdentityErrors["EMPTY_PASSWORD"] = "Password must not be empty";
    IdentityErrors["WRONG_USAGE_OF_WEAK_CRYPTO"] = "Attempting to use a development key while not being in development mode";
    IdentityErrors["WRONG_PASSPHRASE"] = "Key derivation failed - possibly wrong passphrase";
    IdentityErrors["INVALID_PRIVATE_KEY_GIVEN"] = "Invalid private key was given";
    IdentityErrors["INVALID_SECPK256K1_PRIVATE_KEY_GIVEN"] = "The key given was not at least 32 bytes long";
})(IdentityErrors = IdentityErrors || (IdentityErrors = {}));
export var IdentityLogs;
(function (IdentityLogs) {
    IdentityLogs["USING_WEAK_CRYPTO"] = "Using weaker key protection to accelerate node startup";
})(IdentityLogs = IdentityLogs || (IdentityLogs = {}));
/**
 * Tries to read the identity file from disk
 * @param path file system path to identity file
 * @returns Either identity or undefined
 */
async function loadIdentity(path) {
    let identity;
    try {
        identity = Uint8Array.from(await readFile(resolve(path)));
    }
    catch (err) {
        log(`Could not load identity file ${path}`);
        return;
    }
    return identity;
}
const PRIVATE_KEY_SIZE = 32;
/**
 * Persistently store identity on disk
 * @param path file systme path to store identity
 * @param id serialized private key
 */
async function storeIdentity(path, id) {
    await writeFile(resolve(path), id);
}
async function createIdentity(idPath, password, useWeakCrypto = false, privateKey) {
    privateKey = privateKey ?? randomBytes(PRIVATE_KEY_SIZE);
    const peerId = privKeyToPeerId(privateKey);
    const serializedKeyPair = await serializeKeyPair(peerId, password, useWeakCrypto);
    await storeIdentity(idPath, serializedKeyPair);
    return peerId;
}
export async function getIdentity(options) {
    if (options.privateKey) {
        return await createIdentity(options.idPath, options.password, options.useWeakCrypto, options.privateKey);
    }
    if (typeof options.password !== 'string' || options.password.length == 0) {
        throw new Error(IdentityErrors.EMPTY_PASSWORD);
    }
    const storedIdentity = await loadIdentity(options.idPath);
    if (storedIdentity == undefined) {
        log(IdentityErrors.FAIL_TO_LOAD_IDENTITY, options.idPath);
    }
    if (options.useWeakCrypto) {
        log(IdentityLogs.USING_WEAK_CRYPTO);
    }
    if (storedIdentity != undefined) {
        const deserialized = await deserializeKeyPair(storedIdentity, options.password, options.useWeakCrypto);
        if (deserialized.success == false) {
            if (deserialized.error === 'Invalid password') {
                throw new Error(IdentityErrors.WRONG_PASSPHRASE);
            }
            else if (deserialized.error === 'Wrong usage of weak crypto') {
                throw new Error(IdentityErrors.WRONG_USAGE_OF_WEAK_CRYPTO);
            }
            else {
                throw new Error(`Unknown identity error ${deserialized.error}`);
            }
        }
        else {
            return deserialized.identity;
        }
    }
    if (options.initialize) {
        log('Creating new identity', options.idPath);
        return await createIdentity(options.idPath, options.password, options.useWeakCrypto);
    }
    throw new Error(IdentityErrors.FAIL_TO_LOAD_IDENTITY);
}
//# sourceMappingURL=identity.js.map