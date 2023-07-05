/* tslint:disable */
/* eslint-disable */
/**
* Parse a hex string private key to a boxed u8 slice
* @param {string} s
* @returns {Uint8Array}
*/
export function parse_private_key(s: string): Uint8Array;
/**
* @param {any} cli_args
* @returns {HoprdConfig}
*/
export function fetch_configuration(cli_args: any): HoprdConfig;
/**
*/
export function hoprd_misc_initialize_crate(): void;
/**
* @param {(string)[]} cli_args
* @param {any} envs
* @param {string} mono_repo_path
* @param {string} home_path
* @returns {any}
*/
export function parse_cli_arguments(cli_args: (string)[], envs: any, mono_repo_path: string, home_path: string): any;
/**
*/
export function core_strategy_initialize_crate(): void;
/**
* @param {Address} source
* @param {Address} destination
* @returns {Hash}
*/
export function generate_channel_id(source: Address, destination: Address): Hash;
/**
*/
export function core_types_initialize_crate(): void;
/**
* Used in Proof of Relay to derive own half-key (S0)
* The function samples a secp256k1 field element using the given `secret` via `sample_field_element`.
* @param {Uint8Array} secret
* @returns {HalfKey}
*/
export function derive_own_key_share(secret: Uint8Array): HalfKey;
/**
* Used in Proof of Relay to derive the half-key of for the acknowledgement (S1)
* The function samples a secp256k1 field element using the given `secret` via `sample_field_element`.
* @param {Uint8Array} secret
* @returns {HalfKey}
*/
export function derive_ack_key_share(secret: Uint8Array): HalfKey;
/**
* @param {Uint8Array} secret
* @returns {Uint8Array}
*/
export function derive_packet_tag(secret: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} private_key
* @param {Uint8Array} channel_info
* @returns {Uint8Array}
*/
export function derive_commitment_seed(private_key: Uint8Array, channel_info: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} secret
* @returns {Uint8Array}
*/
export function derive_mac_key(secret: Uint8Array): Uint8Array;
/**
* @returns {number}
*/
export function random_float(): number;
/**
* @param {bigint} bound
* @returns {bigint}
*/
export function random_bounded_integer(bound: bigint): bigint;
/**
* @param {bigint} start
* @param {bigint | undefined} end
* @returns {bigint}
*/
export function random_big_integer(start: bigint, end?: bigint): bigint;
/**
* @param {number} start
* @param {number | undefined} end
* @returns {number}
*/
export function random_integer(start: number, end?: number): number;
/**
* @param {Uint8Array} buffer
* @param {number} from
* @param {number} len
*/
export function random_fill(buffer: Uint8Array, from: number, len: number): void;
/**
* @param {Uint8Array} seed
* @param {number} iterations
* @param {number} step_size
* @returns {IteratedHash}
*/
export function iterate_hash(seed: Uint8Array, iterations: number, step_size: number): IteratedHash;
/**
* @param {Uint8Array} hash_value
* @param {Function} hints
* @param {number} max_iterations
* @param {number} step_size
* @param {number | undefined} index_hint
* @returns {Promise<Intermediate>}
*/
export function recover_iterated_hash(hash_value: Uint8Array, hints: Function, max_iterations: number, step_size: number, index_hint?: number): Promise<Intermediate>;
/**
* @param {Uint8Array} key
* @param {Uint8Array} data
* @returns {Uint8Array}
*/
export function calculate_mac(key: Uint8Array, data: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} secret
* @param {Uint8Array} data
* @returns {Uint8Array}
*/
export function create_tagged_mac(secret: Uint8Array, data: Uint8Array): Uint8Array;
/**
*/
export function core_crypto_initialize_crate(): void;
/**
*/
export function core_misc_initialize_crate(): void;
/**
* Returns a struct with readonly constants, needs to be a function
* because Rust does not support exporting constants to WASM
* @returns {CoreConstants}
*/
export function CORE_CONSTANTS(): CoreConstants;
/**
*/
export function utils_misc_initialize_crate(): void;
/**
*/
export function core_ethereum_db_initialize_crate(): void;
/**
*/
export function core_network_initialize_crate(): void;
/**
* @param {any} db
* @returns {Promise<boolean>}
*/
export function db_sanity_test(db: any): Promise<boolean>;
/**
* @param {string} mono_repo_path
* @returns {any}
*/
export function supported_networks(mono_repo_path: string): any;
/**
* @param {string} mono_repo_path
* @param {string} id
* @param {string | undefined} maybe_custom_provider
* @returns {any}
*/
export function resolve_network(mono_repo_path: string, id: string, maybe_custom_provider?: string): any;
/**
* @param {number} status
* @returns {number}
*/
export function channel_status_to_number(status: number): number;
/**
* @param {number} number
* @returns {number | undefined}
*/
export function number_to_channel_status(number: number): number | undefined;
/**
* @param {number} status
* @returns {string}
*/
export function channel_status_to_string(status: number): string;
/**
* @param {Hash} message
* @returns {Hash}
*/
export function ethereum_signed_hash(message: Hash): Hash;
/**
* Dummy function to test WASM.
* @returns {string}
*/
export function dummy_get_one(): string;
/**
* Reads the given package.json file and determines its version.
* @param {string} package_file
* @returns {string}
*/
export function get_package_version(package_file: string): string;
/**
* Returns a struct with readonly constants, needs to be a function
* because Rust does not support exporting constants to WASM
* @returns {CoreEthereumConstants}
*/
export function CORE_ETHEREUM_CONSTANTS(): CoreEthereumConstants;
/**
*/
export function utils_types_initialize_crate(): void;
/**
*/
export function utils_log_initialize_crate(): void;
/**
*/
export function core_ethereum_misc_initialize_crate(): void;
/**
* Describes status of a channel
*/
export enum ChannelStatus {
  Closed = 0,
  WaitingForCommitment = 1,
  Open = 2,
  PendingToClose = 3,
}
/**
* Represents a type of the balance: native or HOPR tokens.
*/
export enum BalanceType {
  Native = 0,
  HOPR = 1,
}
/**
*/
export enum EnvironmentType {
  Production = 0,
  Staging = 1,
  Development = 2,
  Local = 3,
}
/**
* Represents a node announcement entry on the block chain.
* This contains node's public key and optional announcement information (multiaddress, block number).
*/
export class AccountEntry {
  free(): void;
/**
* Gets public key as an address
* @returns {Address}
*/
  get_address(): Address;
/**
* Gets public key as a PeerId string
* @returns {string}
*/
  get_peer_id_str(): string;
/**
* Gets multiaddress as string if this peer ID has been announced.
* @returns {string | undefined}
*/
  get_multiaddress_str(): string | undefined;
/**
* Gets the block number of the announcement if this peer ID has been announced.
* @returns {number | undefined}
*/
  updated_at(): number | undefined;
/**
* Is the node announced?
* @returns {boolean}
*/
  has_announced(): boolean;
/**
* If the node has announced, did it announce with routing information ?
* @returns {boolean}
*/
  contains_routing_info(): boolean;
/**
* @param {PublicKey} public_key
* @param {string | undefined} multiaddr
* @param {number | undefined} updated_at
*/
  constructor(public_key: PublicKey, multiaddr?: string, updated_at?: number);
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {Uint8Array} data
* @returns {AccountEntry}
*/
  static deserialize(data: Uint8Array): AccountEntry;
/**
* @returns {AccountEntry}
*/
  clone(): AccountEntry;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  public_key: PublicKey;
}
/**
* Contains acknowledgment information and the respective ticket
*/
export class AcknowledgedTicket {
  free(): void;
/**
* @param {Ticket} ticket
* @param {Response} response
* @param {Hash} pre_image
* @param {PublicKey} signer
*/
  constructor(ticket: Ticket, response: Response, pre_image: Hash, signer: PublicKey);
/**
* @param {Hash} hash
*/
  set_preimage(hash: Hash): void;
/**
* @param {Uint8Array} data
* @returns {AcknowledgedTicket}
*/
  static deserialize(data: Uint8Array): AcknowledgedTicket;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {AcknowledgedTicket} other
* @returns {boolean}
*/
  eq(other: AcknowledgedTicket): boolean;
/**
* @param {PublicKey} issuer
* @returns {boolean}
*/
  verify(issuer: PublicKey): boolean;
/**
* @returns {AcknowledgedTicket}
*/
  clone(): AcknowledgedTicket;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  pre_image: Hash;
/**
*/
  response: Response;
/**
*/
  signer: PublicKey;
/**
*/
  ticket: Ticket;
}
/**
* Represents packet acknowledgement
*/
export class Acknowledgement {
  free(): void;
/**
* @param {AcknowledgementChallenge} ack_challenge
* @param {HalfKey} ack_key_share
* @param {Uint8Array} private_key
*/
  constructor(ack_challenge: AcknowledgementChallenge, ack_key_share: HalfKey, private_key: Uint8Array);
/**
* Validates the acknowledgement. Must be called immediately after deserialization or otherwise
* any operations with the deserialized acknowledgment will panic.
* @param {PublicKey} own_public_key
* @param {PublicKey} sender_public_key
* @returns {boolean}
*/
  validate(own_public_key: PublicKey, sender_public_key: PublicKey): boolean;
/**
* Obtains the acknowledged challenge out of this acknowledgment.
* @returns {HalfKeyChallenge}
*/
  ack_challenge(): HalfKeyChallenge;
/**
* @param {Uint8Array} data
* @returns {Acknowledgement}
*/
  static deserialize(data: Uint8Array): Acknowledgement;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {Acknowledgement} other
* @returns {boolean}
*/
  eq(other: Acknowledgement): boolean;
/**
* @returns {Acknowledgement}
*/
  clone(): Acknowledgement;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  ack_key_share: HalfKey;
}
/**
* Contains cryptographic challenge that needs to be solved for acknowledging a packet.
*/
export class AcknowledgementChallenge {
  free(): void;
/**
* @param {HalfKeyChallenge} ack_challenge
* @param {Uint8Array} private_key
*/
  constructor(ack_challenge: HalfKeyChallenge, private_key: Uint8Array);
/**
* Checks if the given secret solves this challenge.
* @param {Uint8Array} secret
* @returns {boolean}
*/
  solve(secret: Uint8Array): boolean;
/**
* @param {PublicKey} public_key
* @param {Signature} signature
* @param {HalfKeyChallenge} challenge
* @returns {boolean}
*/
  static verify(public_key: PublicKey, signature: Signature, challenge: HalfKeyChallenge): boolean;
/**
* @param {HalfKeyChallenge} ack_challenge
* @param {PublicKey} public_key
* @returns {boolean}
*/
  validate(ack_challenge: HalfKeyChallenge, public_key: PublicKey): boolean;
/**
* @param {Uint8Array} data
* @returns {AcknowledgementChallenge}
*/
  static deserialize(data: Uint8Array): AcknowledgementChallenge;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {AcknowledgementChallenge} other
* @returns {boolean}
*/
  eq(other: AcknowledgementChallenge): boolean;
/**
* @returns {AcknowledgementChallenge}
*/
  clone(): AcknowledgementChallenge;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  ack_challenge?: HalfKeyChallenge;
/**
*/
  signature: Signature;
}
/**
* Represents an Ethereum address
*/
export class Address {
  free(): void;
/**
* @param {Uint8Array} bytes
*/
  constructor(bytes: Uint8Array);
/**
* @returns {Uint8Array}
*/
  to_bytes32(): Uint8Array;
/**
* @returns {string}
*/
  to_string(): string;
/**
* @param {string} str
* @returns {Address}
*/
  static from_string(str: string): Address;
/**
* @param {Uint8Array} data
* @returns {Address}
*/
  static deserialize(data: Uint8Array): Address;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {Address} other
* @returns {boolean}
*/
  eq(other: Address): boolean;
/**
* @returns {Address}
*/
  clone(): Address;
/**
* @returns {number}
*/
  static size(): number;
}
/**
*/
export class Api {
  free(): void;
/**
* @returns {boolean}
*/
  is_auth_disabled(): boolean;
/**
* @returns {string | undefined}
*/
  auth_token(): string | undefined;
/**
*/
  enable: boolean;
/**
*/
  host: Host;
}
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
  free(): void;
/**
* @returns {Promise<any>}
*/
  next(): Promise<any>;
}
/**
* Represents balance of some coin or token.
*/
export class Balance {
  free(): void;
/**
* Creates new balance of the given type from the base 10 integer string
* @param {string} value
* @param {number} balance_type
*/
  constructor(value: string, balance_type: number);
/**
* Creates zero balance of the given type
* @param {number} balance_type
* @returns {Balance}
*/
  static zero(balance_type: number): Balance;
/**
* Retrieves the type (symbol) of the balance
* @returns {number}
*/
  balance_type(): number;
/**
* Creates balance of the given value with the same symbol
* @param {string} value
* @returns {Balance}
*/
  of_same(value: string): Balance;
/**
* Serializes just the value of the balance (not the symbol)
* @returns {Uint8Array}
*/
  serialize_value(): Uint8Array;
/**
* @param {Balance} other
* @returns {boolean}
*/
  lt(other: Balance): boolean;
/**
* @param {Balance} other
* @returns {boolean}
*/
  lte(other: Balance): boolean;
/**
* @param {Balance} other
* @returns {boolean}
*/
  gt(other: Balance): boolean;
/**
* @param {Balance} other
* @returns {boolean}
*/
  gte(other: Balance): boolean;
/**
* @param {Balance} other
* @returns {Balance}
*/
  add(other: Balance): Balance;
/**
* @param {bigint} amount
* @returns {Balance}
*/
  iadd(amount: bigint): Balance;
/**
* @param {Balance} other
* @returns {Balance}
*/
  sub(other: Balance): Balance;
/**
* @param {bigint} amount
* @returns {Balance}
*/
  isub(amount: bigint): Balance;
/**
* @param {Balance} other
* @returns {Balance}
*/
  mul(other: Balance): Balance;
/**
* @param {bigint} amount
* @returns {Balance}
*/
  imul(amount: bigint): Balance;
/**
* @returns {U256}
*/
  amount(): U256;
/**
* @param {Uint8Array} data
* @param {number} balance_type
* @returns {Balance}
*/
  static deserialize(data: Uint8Array, balance_type: number): Balance;
/**
* @returns {string}
*/
  to_formatted_string(): string;
/**
* @param {Balance} other
* @returns {boolean}
*/
  eq(other: Balance): boolean;
/**
* @returns {Balance}
*/
  clone(): Balance;
/**
* @returns {string}
*/
  to_string(): string;
/**
* @returns {number}
*/
  static size(): number;
}
/**
*/
export class Chain {
  free(): void;
/**
*/
  check_unrealized_balance: boolean;
/**
*/
  on_chain_confirmations: number;
/**
*/
  provider?: string;
}
/**
* Holds all information we need about the blockchain network
* the client is going to use
*/
export class ChainOptions {
  free(): void;
/**
* >= 0
*/
  chain_id: number;
/**
* a valid HTTP url pointing at a RPC endpoint
*/
  default_provider: string;
/**
*/
  description: string;
/**
* a valid HTTP url pointing at a RPC endpoint
*/
  etherscan_api_url?: string;
/**
*/
  hopr_token_name: string;
/**
*/
  id: string;
/**
*/
  live: boolean;
/**
* The absolute maximum you are willing to pay per unit of gas to get your transaction included in a block, e.g. '10 gwei'
*/
  max_fee_per_gas: string;
/**
* Tips paid directly to miners, e.g. '2 gwei'
*/
  max_priority_fee_per_gas: string;
/**
*/
  native_token_name: string;
}
/**
* Natural extension of the Curve Point to the Proof-of-Relay challenge.
* Proof-of-Relay challenge is a secp256k1 curve point.
*/
export class Challenge {
  free(): void;
/**
* Converts the PoR challenge to an Ethereum challenge.
* This is a one-way (lossy) operation, since the corresponding curve point is hashed
* with the hash value then truncated.
* @returns {EthereumChallenge}
*/
  to_ethereum_challenge(): EthereumChallenge;
/**
* @param {HalfKeyChallenge} own_share
* @param {HalfKeyChallenge} hint
* @returns {Challenge}
*/
  static from_hint_and_share(own_share: HalfKeyChallenge, hint: HalfKeyChallenge): Challenge;
/**
* @param {HalfKeyChallenge} own_share
* @param {HalfKey} half_key
* @returns {Challenge}
*/
  static from_own_share_and_half_key(own_share: HalfKeyChallenge, half_key: HalfKey): Challenge;
/**
* @param {Uint8Array} data
* @returns {Challenge}
*/
  static deserialize(data: Uint8Array): Challenge;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {Challenge}
*/
  clone(): Challenge;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  curve_point: CurvePoint;
}
/**
* Overall description of a channel
*/
export class ChannelEntry {
  free(): void;
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
  constructor(source: PublicKey, destination: PublicKey, balance: Balance, commitment: Hash, ticket_epoch: U256, ticket_index: U256, status: number, channel_epoch: U256, closure_time: U256);
/**
* Generates the ticket ID using the source and destination address
* @returns {Hash}
*/
  get_id(): Hash;
/**
* Checks if the closure time of this channel has passed.
* @returns {boolean | undefined}
*/
  closure_time_passed(): boolean | undefined;
/**
* Calculates the remaining channel closure grace period.
* @returns {bigint | undefined}
*/
  remaining_closure_time(): bigint | undefined;
/**
* @param {Uint8Array} data
* @returns {ChannelEntry}
*/
  static deserialize(data: Uint8Array): ChannelEntry;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {ChannelEntry} other
* @returns {boolean}
*/
  eq(other: ChannelEntry): boolean;
/**
* @returns {ChannelEntry}
*/
  clone(): ChannelEntry;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  balance: Balance;
/**
*/
  channel_epoch: U256;
/**
*/
  closure_time: U256;
/**
*/
  commitment: Hash;
/**
*/
  destination: PublicKey;
/**
*/
  source: PublicKey;
/**
*/
  status: number;
/**
*/
  ticket_epoch: U256;
/**
*/
  ticket_index: U256;
}
/**
* Takes all CLI arguments whose structure is known at compile-time.
* Arguments whose structure, e.g. their default values depend on
* file contents need be specified using `clap`s builder API
*/
export class CliArgs {
  free(): void;
/**
*/
  allow_local_node_connections?: boolean;
/**
*/
  allow_private_node_connections?: boolean;
/**
*/
  announce?: boolean;
/**
*/
  api?: boolean;
/**
*/
  api_host?: string;
/**
*/
  api_port?: number;
/**
*/
  api_token?: string;
/**
*/
  auto_redeem_tickets?: boolean;
/**
*/
  check_unrealized_balance?: boolean;
/**
*/
  configuration_file_path?: string;
/**
*/
  data: string;
/**
*/
  default_strategy?: string;
/**
*/
  disable_api_authentication?: boolean;
/**
*/
  dry_run: boolean;
/**
*/
  force_init?: boolean;
/**
*/
  health_check?: boolean;
/**
*/
  health_check_host?: string;
/**
*/
  health_check_port?: number;
/**
*/
  heartbeat_interval?: number;
/**
*/
  heartbeat_threshold?: number;
/**
*/
  heartbeat_variance?: number;
/**
*/
  host?: Host;
/**
*/
  identity: string;
/**
*/
  init?: boolean;
/**
*/
  max_auto_channels?: number;
/**
*/
  max_parallel_connections?: number;
/**
* network
*/
  network: string;
/**
*/
  network_quality_threshold?: number;
/**
*/
  no_relay?: boolean;
/**
*/
  on_chain_confirmations?: number;
/**
*/
  password?: string;
/**
*/
  private_key?: string;
/**
*/
  provider?: string;
/**
*/
  test_announce_local_addresses?: boolean;
/**
*/
  test_local_mode_stun?: boolean;
/**
*/
  test_no_direct_connections?: boolean;
/**
*/
  test_no_webrtc_upgrade?: boolean;
/**
*/
  test_prefer_local_addresses?: boolean;
/**
*/
  test_use_weak_crypto?: boolean;
}
/**
*/
export class CoreConstants {
  free(): void;
/**
*/
  readonly DEFAULT_HEARTBEAT_INTERVAL: number;
/**
*/
  readonly DEFAULT_HEARTBEAT_INTERVAL_VARIANCE: number;
/**
*/
  readonly DEFAULT_HEARTBEAT_THRESHOLD: number;
/**
*/
  readonly DEFAULT_MAX_PARALLEL_CONNECTIONS: number;
/**
*/
  readonly DEFAULT_MAX_PARALLEL_CONNECTIONS_PUBLIC_RELAY: number;
/**
*/
  readonly DEFAULT_NETWORK_QUALITY_THRESHOLD: number;
}
/**
*/
export class CoreEthereumConstants {
  free(): void;
/**
*/
  readonly DEFAULT_CONFIRMATIONS: number;
/**
*/
  readonly INDEXER_BLOCK_RANGE: number;
/**
*/
  readonly INDEXER_TIMEOUT: number;
/**
*/
  readonly MAX_TRANSACTION_BACKOFF: number;
/**
*/
  readonly PROVIDER_CACHE_TTL: number;
/**
*/
  readonly TX_CONFIRMATION_WAIT: number;
}
/**
* Represent an uncompressed elliptic curve point on the secp256k1 curve
*/
export class CurvePoint {
  free(): void;
/**
* Converts the uncompressed representation of the curve point to Ethereum address.
* @returns {Address}
*/
  to_address(): Address;
/**
* @param {Uint8Array} exponent
* @returns {CurvePoint}
*/
  static from_exponent(exponent: Uint8Array): CurvePoint;
/**
* @param {string} str
* @returns {CurvePoint}
*/
  static from_str(str: string): CurvePoint;
/**
* @param {string} peer_id
* @returns {CurvePoint}
*/
  static from_peerid_str(peer_id: string): CurvePoint;
/**
* @returns {string}
*/
  to_peerid_str(): string;
/**
* @param {Uint8Array} bytes
* @returns {CurvePoint}
*/
  static deserialize(bytes: Uint8Array): CurvePoint;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {Uint8Array}
*/
  serialize_compressed(): Uint8Array;
/**
* @param {CurvePoint} other
* @returns {boolean}
*/
  eq(other: CurvePoint): boolean;
/**
* @returns {CurvePoint}
*/
  clone(): CurvePoint;
/**
* @returns {number}
*/
  static size(): number;
}
/**
*/
export class Database {
  free(): void;
/**
* @param {any} db
* @param {PublicKey} public_key
*/
  constructor(db: any, public_key: PublicKey);
/**
* @param {ChannelEntry | undefined} filter
* @returns {Promise<WasmVecAcknowledgedTicket>}
*/
  get_acknowledged_tickets(filter?: ChannelEntry): Promise<WasmVecAcknowledgedTicket>;
/**
* @param {ChannelEntry} source
* @returns {Promise<void>}
*/
  delete_acknowledged_tickets_from(source: ChannelEntry): Promise<void>;
/**
* @param {AcknowledgedTicket} ticket
* @returns {Promise<void>}
*/
  delete_acknowledged_ticket(ticket: AcknowledgedTicket): Promise<void>;
/**
* @param {Hash} channel
* @param {number} iteration
* @returns {Promise<Hash | undefined>}
*/
  get_commitment(channel: Hash, iteration: number): Promise<Hash | undefined>;
/**
* @param {Hash} channel
* @returns {Promise<Hash | undefined>}
*/
  get_current_commitment(channel: Hash): Promise<Hash | undefined>;
/**
* @param {Hash} channel
* @param {Hash} commitment
* @returns {Promise<void>}
*/
  set_current_commitment(channel: Hash, commitment: Hash): Promise<void>;
/**
* @returns {Promise<number>}
*/
  get_latest_block_number(): Promise<number>;
/**
* @param {number} number
* @returns {Promise<void>}
*/
  update_latest_block_number(number: number): Promise<void>;
/**
* @returns {Promise<Snapshot | undefined>}
*/
  get_latest_confirmed_snapshot(): Promise<Snapshot | undefined>;
/**
* @param {Hash} channel
* @returns {Promise<ChannelEntry | undefined>}
*/
  get_channel(channel: Hash): Promise<ChannelEntry | undefined>;
/**
* @returns {Promise<WasmVecChannelEntry>}
*/
  get_channels(): Promise<WasmVecChannelEntry>;
/**
* @returns {Promise<WasmVecChannelEntry>}
*/
  get_channels_open(): Promise<WasmVecChannelEntry>;
/**
* @param {Hash} channel_id
* @param {ChannelEntry} channel
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  update_channel_and_snapshot(channel_id: Hash, channel: ChannelEntry, snapshot: Snapshot): Promise<void>;
/**
* @param {Address} address
* @returns {Promise<AccountEntry | undefined>}
*/
  get_account(address: Address): Promise<AccountEntry | undefined>;
/**
* @param {AccountEntry} account
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  update_account_and_snapshot(account: AccountEntry, snapshot: Snapshot): Promise<void>;
/**
* @returns {Promise<WasmVecAccountEntry>}
*/
  get_accounts(): Promise<WasmVecAccountEntry>;
/**
* @returns {Promise<Balance>}
*/
  get_redeemed_tickets_value(): Promise<Balance>;
/**
* @returns {Promise<number>}
*/
  get_redeemed_tickets_count(): Promise<number>;
/**
* @returns {Promise<number>}
*/
  get_neglected_tickets_count(): Promise<number>;
/**
* @returns {Promise<number>}
*/
  get_pending_tickets_count(): Promise<number>;
/**
* @returns {Promise<number>}
*/
  get_losing_tickets_count(): Promise<number>;
/**
* @param {Address} counterparty
* @returns {Promise<Balance>}
*/
  get_pending_balance_to(counterparty: Address): Promise<Balance>;
/**
* @param {Ticket} ticket
* @returns {Promise<void>}
*/
  mark_pending(ticket: Ticket): Promise<void>;
/**
* @param {Ticket} ticket
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  resolve_pending(ticket: Ticket, snapshot: Snapshot): Promise<void>;
/**
* @param {AcknowledgedTicket} ticket
* @returns {Promise<void>}
*/
  mark_redeemed(ticket: AcknowledgedTicket): Promise<void>;
/**
* @param {AcknowledgedTicket} ticket
* @returns {Promise<void>}
*/
  mark_losing_acked_ticket(ticket: AcknowledgedTicket): Promise<void>;
/**
* @returns {Promise<Balance>}
*/
  get_rejected_tickets_value(): Promise<Balance>;
/**
* @returns {Promise<number>}
*/
  get_rejected_tickets_count(): Promise<number>;
/**
* @param {PublicKey} src
* @param {PublicKey} dest
* @returns {Promise<ChannelEntry | undefined>}
*/
  get_channel_x(src: PublicKey, dest: PublicKey): Promise<ChannelEntry | undefined>;
/**
* @param {PublicKey} dest
* @returns {Promise<ChannelEntry | undefined>}
*/
  get_channel_to(dest: PublicKey): Promise<ChannelEntry | undefined>;
/**
* @param {PublicKey} src
* @returns {Promise<ChannelEntry | undefined>}
*/
  get_channel_from(src: PublicKey): Promise<ChannelEntry | undefined>;
/**
* @param {Address} address
* @returns {Promise<WasmVecChannelEntry>}
*/
  get_channels_from(address: Address): Promise<WasmVecChannelEntry>;
/**
* @param {Address} address
* @returns {Promise<WasmVecChannelEntry>}
*/
  get_channels_to(address: Address): Promise<WasmVecChannelEntry>;
/**
* @returns {Promise<Balance>}
*/
  get_hopr_balance(): Promise<Balance>;
/**
* @param {Balance} balance
* @returns {Promise<void>}
*/
  set_hopr_balance(balance: Balance): Promise<void>;
/**
* @param {Balance} balance
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  add_hopr_balance(balance: Balance, snapshot: Snapshot): Promise<void>;
/**
* @param {Balance} balance
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  sub_hopr_balance(balance: Balance, snapshot: Snapshot): Promise<void>;
/**
* @returns {Promise<boolean>}
*/
  is_network_registry_enabled(): Promise<boolean>;
/**
* @param {boolean} enabled
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  set_network_registry(enabled: boolean, snapshot: Snapshot): Promise<void>;
/**
* @param {PublicKey} public_key
* @param {Address} account
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  add_to_network_registry(public_key: PublicKey, account: Address, snapshot: Snapshot): Promise<void>;
/**
* @param {PublicKey} public_key
* @param {Address} account
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  remove_from_network_registry(public_key: PublicKey, account: Address, snapshot: Snapshot): Promise<void>;
/**
* @param {PublicKey} public_key
* @returns {Promise<Address | undefined>}
*/
  get_account_from_network_registry(public_key: PublicKey): Promise<Address | undefined>;
/**
* @param {Address} account
* @returns {Promise<WasmVecPublicKey>}
*/
  find_hopr_node_using_account_in_network_registry(account: Address): Promise<WasmVecPublicKey>;
/**
* @param {Address} account
* @returns {Promise<boolean>}
*/
  is_eligible(account: Address): Promise<boolean>;
/**
* @param {Address} account
* @param {boolean} eligible
* @param {Snapshot} snapshot
* @returns {Promise<void>}
*/
  set_eligible(account: Address, eligible: boolean, snapshot: Snapshot): Promise<void>;
}
/**
*/
export class Db {
  free(): void;
/**
* Path to the directory containing the database
*/
  data: string;
/**
*/
  force_initialize: boolean;
/**
*/
  initialize: boolean;
}
/**
* Represents and Ethereum challenge.
*/
export class EthereumChallenge {
  free(): void;
/**
* @param {Uint8Array} data
*/
  constructor(data: Uint8Array);
/**
* @param {Uint8Array} data
* @returns {EthereumChallenge}
*/
  static deserialize(data: Uint8Array): EthereumChallenge;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @param {EthereumChallenge} other
* @returns {boolean}
*/
  eq(other: EthereumChallenge): boolean;
/**
* @returns {EthereumChallenge}
*/
  clone(): EthereumChallenge;
/**
* @returns {number}
*/
  static size(): number;
}
/**
*/
export class GroupElement {
  free(): void;
/**
* @returns {GroupElement}
*/
  static random(): GroupElement;
/**
* @returns {Uint8Array}
*/
  coefficient(): Uint8Array;
/**
* @returns {CurvePoint}
*/
  element(): CurvePoint;
}
/**
* Represents a half-key used for Proof of Relay
* Half-key is equivalent to a non-zero scalar in the field used by secp256k1, but the type
* itself does not validate nor enforce this fact,
*/
export class HalfKey {
  free(): void;
/**
* @param {Uint8Array} half_key
*/
  constructor(half_key: Uint8Array);
/**
* Converts the non-zero scalar represented by this half-key into the half-key challenge.
* This operation naturally enforces the underlying scalar to be non-zero.
* @returns {HalfKeyChallenge}
*/
  to_challenge(): HalfKeyChallenge;
/**
* @param {Uint8Array} data
* @returns {HalfKey}
*/
  static deserialize(data: Uint8Array): HalfKey;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {HalfKey}
*/
  clone(): HalfKey;
/**
* @param {HalfKey} other
* @returns {boolean}
*/
  eq(other: HalfKey): boolean;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Represents a challenge for the half-key in Proof of Relay.
* Half-key challenge is equivalent to a secp256k1 curve point.
* Therefore, HalfKeyChallenge can be obtained from a HalfKey.
*/
export class HalfKeyChallenge {
  free(): void;
/**
* @param {Uint8Array} half_key_challenge
*/
  constructor(half_key_challenge: Uint8Array);
/**
* @returns {Address}
*/
  to_address(): Address;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @param {HalfKeyChallenge} other
* @returns {boolean}
*/
  eq(other: HalfKeyChallenge): boolean;
/**
* @returns {string}
*/
  to_peerid_str(): string;
/**
* @param {string} str
* @returns {HalfKeyChallenge}
*/
  static from_str(str: string): HalfKeyChallenge;
/**
* @param {string} peer_id
* @returns {HalfKeyChallenge}
*/
  static from_peerid_str(peer_id: string): HalfKeyChallenge;
/**
* @param {Uint8Array} data
* @returns {HalfKeyChallenge}
*/
  static deserialize(data: Uint8Array): HalfKeyChallenge;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {HalfKeyChallenge}
*/
  clone(): HalfKeyChallenge;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Represents an Ethereum 256-bit hash value
* This implementation instantiates the hash via Keccak256 digest.
*/
export class Hash {
  free(): void;
/**
* @param {Uint8Array} hash
*/
  constructor(hash: Uint8Array);
/**
* Convenience method that creates a new hash by hashing this.
* @returns {Hash}
*/
  hash(): Hash;
/**
* @param {(Uint8Array)[]} inputs
* @returns {Hash}
*/
  static create(inputs: (Uint8Array)[]): Hash;
/**
* @param {Uint8Array} data
* @returns {Hash}
*/
  static deserialize(data: Uint8Array): Hash;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {Hash} other
* @returns {boolean}
*/
  eq(other: Hash): boolean;
/**
* @returns {Hash}
*/
  clone(): Hash;
/**
* @returns {number}
*/
  static size(): number;
}
/**
*/
export class HealthCheck {
  free(): void;
/**
*/
  enable: boolean;
/**
*/
  host: string;
/**
*/
  port: number;
}
/**
*/
export class Heartbeat {
  free(): void;
/**
*/
  interval: number;
/**
*/
  threshold: number;
/**
*/
  variance: number;
}
/**
*/
export class HoprdConfig {
  free(): void;
/**
* @returns {string}
*/
  as_redacted_string(): string;
/**
*/
  api: Api;
/**
*/
  chain: Chain;
/**
*/
  db: Db;
/**
*/
  healthcheck: HealthCheck;
/**
*/
  heartbeat: Heartbeat;
/**
*/
  host: Host;
/**
*/
  identity: Identity;
/**
*/
  network: string;
/**
*/
  network_options: NetworkOptions;
/**
*/
  strategy: Strategy;
/**
*/
  test: Testing;
}
/**
*/
export class Host {
  free(): void;
/**
*/
  ip: string;
/**
*/
  port: number;
}
/**
*/
export class Identity {
  free(): void;
/**
*/
  file: string;
/**
*/
  password: string;
/**
*/
  private_key?: string;
}
/**
* Contains the intermediate result in the hash iteration progression
*/
export class Intermediate {
  free(): void;
/**
*/
  intermediate: Uint8Array;
/**
*/
  iteration: number;
}
/**
*/
export class IteratedHash {
  free(): void;
/**
* @returns {Uint8Array}
*/
  hash(): Uint8Array;
/**
* @returns {number}
*/
  count_intermediates(): number;
/**
* @param {number} index
* @returns {Intermediate | undefined}
*/
  intermediate(index: number): Intermediate | undefined;
}
/**
*/
export class IteratorResult {
  free(): void;
}
/**
*/
export class KeyPair {
  free(): void;
/**
*/
  private: Uint8Array;
/**
*/
  public: PublicKey;
}
/**
* Holds all information about the protocol network
* to be used by the client
*/
export class Network {
  free(): void;
/**
* an Ethereum address
*/
  boost_contract_address: string;
/**
* must match one of the Network.id
*/
  chain: string;
/**
* an Ethereum address
*/
  channels_contract_address: string;
/**
*/
  environment_type: number;
/**
*/
  id: string;
/**
*/
  indexer_start_block_number: number;
/**
* an Ethereum address
*/
  network_registry_contract_address: string;
/**
* an Ethereum address
*/
  network_registry_proxy_contract_address: string;
/**
* an Ethereum address
*/
  stake_contract_address: string;
/**
* the associated staking season
*/
  stake_season?: number;
/**
* an Ethereum address
*/
  token_contract_address: string;
/**
*/
  version_range: string;
/**
* an Ethereum address
*/
  xhopr_contract_address: string;
}
/**
*/
export class NetworkOptions {
  free(): void;
/**
*/
  allow_local_node_connections: boolean;
/**
*/
  allow_private_node_connections: boolean;
/**
*/
  announce: boolean;
/**
*/
  max_parallel_connections: number;
/**
*/
  network_quality_threshold: number;
/**
*/
  no_relay: boolean;
}
/**
* Represents an Ed25519 public key.
* This public key is always internally in a compressed form, and therefore unsuitable for calculations.
* Because of this fact, the OffchainPublicKey is BinarySerializable as opposed to PublicKey
*/
export class OffchainPublicKey {
  free(): void;
/**
* Generates a new random public key.
* Because the corresponding private key is discarded, this might be useful only for testing purposes.
* @returns {OffchainPublicKey}
*/
  static random(): OffchainPublicKey;
/**
* @param {Uint8Array} bytes
* @returns {OffchainPublicKey}
*/
  static deserialize(bytes: Uint8Array): OffchainPublicKey;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {string} peer_id
* @returns {OffchainPublicKey}
*/
  static from_peerid_str(peer_id: string): OffchainPublicKey;
/**
* @returns {string}
*/
  to_peerid_str(): string;
/**
* @param {Uint8Array} private_key
* @returns {OffchainPublicKey}
*/
  static from_privkey(private_key: Uint8Array): OffchainPublicKey;
/**
* @param {OffchainPublicKey} other
* @returns {boolean}
*/
  eq(other: OffchainPublicKey): boolean;
/**
* @returns {OffchainPublicKey}
*/
  clone(): OffchainPublicKey;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Pseudo-Random Generator (PRG) function that is instantiated
* using AES-128 block cipher in Counter mode (with 32-bit counter).
* It forms an infinite sequence of pseudo-random bytes (generated deterministically from the parameters)
* and can be queried by chunks using the `digest` function.
*/
export class PRG {
  free(): void;
/**
* @param {number} from
* @param {number} to
* @returns {Uint8Array}
*/
  digest(from: number, to: number): Uint8Array;
/**
* Creates a PRG instance  using the raw key and IV for the underlying block cipher.
* @param {Uint8Array} key
* @param {Uint8Array} iv
*/
  constructor(key: Uint8Array, iv: Uint8Array);
/**
* Creates a new PRG instance using the given parameters
* @param {PRGParameters} params
* @returns {PRG}
*/
  static from_parameters(params: PRGParameters): PRG;
}
/**
* Parameters for the Pseudo-Random Generator (PRG) function
* This consists of IV and the raw secret key for use by the underlying block cipher.
*/
export class PRGParameters {
  free(): void;
/**
* @returns {Uint8Array}
*/
  key(): Uint8Array;
/**
* @returns {Uint8Array}
*/
  iv(): Uint8Array;
/**
* Creates new parameters for the PRG by expanding the given
* keying material into the secret key and IV for the underlying block cipher.
* @param {Uint8Array} secret
*/
  constructor(secret: Uint8Array);
}
/**
* Implementation of Pseudo-Random Permutation (PRP).
* Currently based on the Lioness wide-block cipher.
*/
export class PRP {
  free(): void;
/**
* @param {Uint8Array} plaintext
* @returns {Uint8Array}
*/
  forward(plaintext: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} ciphertext
* @returns {Uint8Array}
*/
  inverse(ciphertext: Uint8Array): Uint8Array;
/**
* Creates new instance of the PRP using the raw key and IV.
* @param {Uint8Array} key
* @param {Uint8Array} iv
* @returns {PRP}
*/
  static new(key: Uint8Array, iv: Uint8Array): PRP;
/**
* Creates a new PRP instance using the given parameters
* @param {PRPParameters} params
*/
  constructor(params: PRPParameters);
}
/**
* Parameters for the Pseudo-Random Permutation (PRP) function
* This consists of IV and the raw secret key for use by the underlying cryptographic transformation.
*/
export class PRPParameters {
  free(): void;
/**
* @returns {Uint8Array}
*/
  key(): Uint8Array;
/**
* @returns {Uint8Array}
*/
  iv(): Uint8Array;
/**
* Creates new parameters for the PRP by expanding the given
* keying material into the secret key and IV for the underlying cryptographic transformation.
* @param {Uint8Array} secret
*/
  constructor(secret: Uint8Array);
}
/**
* Implements passive strategy which does nothing.
*/
export class PassiveStrategy {
  free(): void;
/**
*/
  constructor();
/**
* @param {Balance} balance
* @param {Iterator<any>} peer_ids
* @param {any} outgoing_channels
* @param {Function} quality_of
* @returns {StrategyTickResult}
*/
  tick(balance: Balance, peer_ids: Iterator<any>, outgoing_channels: any, quality_of: Function): StrategyTickResult;
/**
*/
  readonly name: string;
}
/**
*/
export class PendingAcknowledgement {
  free(): void;
/**
* @param {boolean} is_sender
* @param {UnacknowledgedTicket | undefined} ticket
*/
  constructor(is_sender: boolean, ticket?: UnacknowledgedTicket);
/**
* @returns {boolean}
*/
  is_msg_sender(): boolean;
/**
* @returns {UnacknowledgedTicket | undefined}
*/
  ticket(): UnacknowledgedTicket | undefined;
/**
* @param {Uint8Array} data
* @returns {PendingAcknowledgement}
*/
  static deserialize(data: Uint8Array): PendingAcknowledgement;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
}
/**
* Implements promiscuous strategy.
* This strategy opens outgoing channels to peers, which have quality above a given threshold.
* At the same time, it closes outgoing channels opened to peers whose quality dropped below this threshold.
*/
export class PromiscuousStrategy {
  free(): void;
/**
*/
  constructor();
/**
* @param {Balance} balance
* @param {Iterator<any>} peer_ids
* @param {any} outgoing_channels
* @param {Function} quality_of
* @returns {StrategyTickResult}
*/
  tick(balance: Balance, peer_ids: Iterator<any>, outgoing_channels: any, quality_of: Function): StrategyTickResult;
/**
* Determines if the strategy should automatically redeem tickets.
* Defaults to false
*/
  auto_redeem_tickets: boolean;
/**
* If set, the strategy will aggressively close channels (even with peers above the `network_quality_threshold`)
* if the number of opened outgoing channels (regardless if opened by the strategy or manually) exceeds the
* `max_channels` limit.
* Defaults to true
*/
  enforce_max_channels: boolean;
/**
* Maximum number of opened channels the strategy should maintain.
* Defaults to square-root of the sampled network size.
*/
  max_channels?: number;
/**
* A minimum channel token stake. If reached, the channel will be closed and re-opened with `new_channel_stake`.
* Defaults to 0.01 HOPR
*/
  minimum_channel_balance: Balance;
/**
* Minimum token balance of the node. When reached, the strategy will not open any new channels.
* Defaults to 0.01 HOPR
*/
  minimum_node_balance: Balance;
/**
*/
  readonly name: string;
/**
* A quality threshold between 0 and 1 used to determine whether the strategy should open channel with the peer.
* Defaults to 0.5
*/
  network_quality_threshold: number;
/**
* A stake of tokens that should be allocated to a channel opened by the strategy.
* Defaults to 0.1 HOPR
*/
  new_channel_stake: Balance;
}
/**
* Represents a secp256k1 public key.
* This is a "Schrödinger public key", both compressed and uncompressed to save some cycles.
*/
export class PublicKey {
  free(): void;
/**
* Generates a new random public key.
* Because the corresponding private key is discarded, this might be useful only for testing purposes.
* @returns {PublicKey}
*/
  static random(): PublicKey;
/**
* Converts the public key to an Ethereum address
* @returns {Address}
*/
  to_address(): Address;
/**
* Serializes the public key to a binary form.
* @param {boolean} compressed
* @returns {Uint8Array}
*/
  to_bytes(compressed: boolean): Uint8Array;
/**
* Serializes the public key to a binary form and converts it to hexadecimal string representation.
* @param {boolean} compressed
* @returns {string}
*/
  to_hex(compressed: boolean): string;
/**
* @returns {KeyPair}
*/
  static random_keypair(): KeyPair;
/**
* @param {Uint8Array} bytes
* @returns {PublicKey}
*/
  static deserialize(bytes: Uint8Array): PublicKey;
/**
* @param {boolean} compressed
* @returns {Uint8Array}
*/
  serialize(compressed: boolean): Uint8Array;
/**
* @param {string} peer_id
* @returns {PublicKey}
*/
  static from_peerid_str(peer_id: string): PublicKey;
/**
* @returns {string}
*/
  to_peerid_str(): string;
/**
* @param {Uint8Array} hash
* @param {Uint8Array} r
* @param {Uint8Array} s
* @param {number} v
* @returns {PublicKey}
*/
  static from_signature(hash: Uint8Array, r: Uint8Array, s: Uint8Array, v: number): PublicKey;
/**
* @param {Uint8Array} private_key
* @returns {PublicKey}
*/
  static from_privkey(private_key: Uint8Array): PublicKey;
/**
* @param {PublicKey} other
* @returns {boolean}
*/
  eq(other: PublicKey): boolean;
/**
* @returns {number}
*/
  static size_compressed(): number;
/**
* @returns {number}
*/
  static size_uncompressed(): number;
/**
* @returns {PublicKey}
*/
  clone(): PublicKey;
}
/**
* Implements random strategy (cover traffic)
*/
export class RandomStrategy {
  free(): void;
/**
*/
  constructor();
/**
* @param {Balance} balance
* @param {Iterator<any>} peer_ids
* @param {any} outgoing_channels
* @param {Function} quality_of
* @returns {StrategyTickResult}
*/
  tick(balance: Balance, peer_ids: Iterator<any>, outgoing_channels: any, quality_of: Function): StrategyTickResult;
/**
*/
  readonly name: string;
}
/**
*/
export class ResolvedNetwork {
  free(): void;
/**
* an Ethereum address
*/
  boost_contract_address: string;
/**
*/
  chain: ChainOptions;
/**
*/
  channel_contract_deploy_block: number;
/**
* an Ethereum address
*/
  channels_contract_address: string;
/**
*/
  environment_type: number;
/**
* the network identifier, e.g. monte_rosa
*/
  id: string;
/**
* an Ethereum address
*/
  network_registry_contract_address: string;
/**
* an Ethereum address
*/
  network_registry_proxy_contract_address: string;
/**
* an Ethereum address
*/
  stake_contract_address: string;
/**
* an Ethereum address
*/
  token_contract_address: string;
/**
* an Ethereum address
*/
  xhopr_contract_address: string;
}
/**
* Contains a response upon ticket acknowledgement
* It is equivalent to a non-zero secret scalar on secp256k1 (EC private key).
*/
export class Response {
  free(): void;
/**
* @param {Uint8Array} data
*/
  constructor(data: Uint8Array);
/**
* Converts this response to the PoR challenge by turning the non-zero scalar
* represented by this response into a secp256k1 curve point (public key)
* @returns {Challenge}
*/
  to_challenge(): Challenge;
/**
* @param {Uint8Array} data
* @returns {Response}
*/
  static deserialize(data: Uint8Array): Response;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @param {HalfKey} first
* @param {HalfKey} second
* @returns {Response}
*/
  static from_half_keys(first: HalfKey, second: HalfKey): Response;
/**
* @returns {Response}
*/
  clone(): Response;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Structure containing shared keys for peers.
* The members are exposed only using specialized methods.
*/
export class SharedKeys {
  free(): void;
/**
* Get the `alpha` value of the derived shared secrets.
* @returns {Uint8Array}
*/
  get_alpha(): Uint8Array;
/**
* Gets the shared secret of the peer on the given index.
* The indices are assigned in the same order as they were given to the
* [`generate`] function.
* @param {number} peer_idx
* @returns {Uint8Array | undefined}
*/
  get_peer_shared_key(peer_idx: number): Uint8Array | undefined;
/**
* Returns the number of shared keys generated in this structure.
* @returns {number}
*/
  count_shared_keys(): number;
/**
* @param {Uint8Array} alpha
* @param {Uint8Array} private_key
* @returns {SharedKeys}
*/
  static forward_transform(alpha: Uint8Array, private_key: Uint8Array): SharedKeys;
/**
* Generate shared keys given the peer public keys
* @param {(Uint8Array)[]} peer_public_keys
* @returns {SharedKeys}
*/
  static generate(peer_public_keys: (Uint8Array)[]): SharedKeys;
}
/**
* Represents an ECDSA signature based on the secp256k1 curve with recoverable public key.
* This signature encodes the 2-bit recovery information into the
* upper-most bits of MSB of the S value, which are never used by this ECDSA
* instantiation over secp256k1.
*/
export class Signature {
  free(): void;
/**
* @param {Uint8Array} raw_bytes
* @param {number} recovery
*/
  constructor(raw_bytes: Uint8Array, recovery: number);
/**
* Signs the given message using the raw private key.
* @param {Uint8Array} message
* @param {Uint8Array} private_key
* @returns {Signature}
*/
  static sign_message(message: Uint8Array, private_key: Uint8Array): Signature;
/**
* Signs the given hash using the raw private key.
* @param {Uint8Array} hash
* @param {Uint8Array} private_key
* @returns {Signature}
*/
  static sign_hash(hash: Uint8Array, private_key: Uint8Array): Signature;
/**
* Verifies this signature against the given message and a public key (compressed or uncompressed)
* @param {Uint8Array} message
* @param {Uint8Array} public_key
* @returns {boolean}
*/
  verify_message(message: Uint8Array, public_key: Uint8Array): boolean;
/**
* Verifies this signature against the given message and a public key object
* @param {Uint8Array} message
* @param {PublicKey} public_key
* @returns {boolean}
*/
  verify_message_with_pubkey(message: Uint8Array, public_key: PublicKey): boolean;
/**
* Verifies this signature against the given hash and a public key (compressed or uncompressed)
* @param {Uint8Array} hash
* @param {Uint8Array} public_key
* @returns {boolean}
*/
  verify_hash(hash: Uint8Array, public_key: Uint8Array): boolean;
/**
* Verifies this signature against the given message and a public key object
* @param {Uint8Array} hash
* @param {PublicKey} public_key
* @returns {boolean}
*/
  verify_hash_with_pubkey(hash: Uint8Array, public_key: PublicKey): boolean;
/**
* Returns the raw signature, without the encoded public key recovery bit.
* @returns {Uint8Array}
*/
  raw_signature(): Uint8Array;
/**
* @param {Uint8Array} signature
* @returns {Signature}
*/
  static deserialize(signature: Uint8Array): Signature;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {Signature}
*/
  clone(): Signature;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Represents a snapshot in the blockchain
*/
export class Snapshot {
  free(): void;
/**
* @param {U256} block_number
* @param {U256} transaction_index
* @param {U256} log_index
*/
  constructor(block_number: U256, transaction_index: U256, log_index: U256);
/**
* @param {Uint8Array} data
* @returns {Snapshot}
*/
  static deserialize(data: Uint8Array): Snapshot;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {Snapshot}
*/
  clone(): Snapshot;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  block_number: U256;
/**
*/
  log_index: U256;
/**
*/
  transaction_index: U256;
}
/**
*/
export class Strategy {
  free(): void;
/**
*/
  auto_redeem_tickets: boolean;
/**
*/
  max_auto_channels?: number;
/**
*/
  name: string;
}
/**
*/
export class StrategyTickResult {
  free(): void;
/**
* @param {number} max_auto_channels
* @param {any} to_open
* @param {(string)[]} to_close
*/
  constructor(max_auto_channels: number, to_open: any, to_close: (string)[]);
/**
* @returns {any}
*/
  to_open(): any;
/**
* @returns {(string)[]}
*/
  to_close(): (string)[];
/**
*/
  readonly max_auto_channels: number;
}
/**
*/
export class Testing {
  free(): void;
/**
*/
  announce_local_addresses: boolean;
/**
*/
  local_mode_stun: boolean;
/**
*/
  no_direct_connections: boolean;
/**
*/
  no_webrtc_upgrade: boolean;
/**
*/
  prefer_local_addresses: boolean;
/**
*/
  use_weak_crypto: boolean;
}
/**
* Contains the overall description of a ticket with a signature
*/
export class Ticket {
  free(): void;
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
  static new(counterparty: Address, epoch: U256, index: U256, amount: Balance, win_prob: U256, channel_epoch: U256, signing_key: Uint8Array): Ticket;
/**
* @param {EthereumChallenge} challenge
* @param {Uint8Array} signing_key
*/
  set_challenge(challenge: EthereumChallenge, signing_key: Uint8Array): void;
/**
* Signs the ticket using the given private key.
* @param {Uint8Array} signing_key
*/
  sign(signing_key: Uint8Array): void;
/**
* Convenience method for creating a zero-hop ticket
* @param {PublicKey} destination
* @param {Uint8Array} private_key
* @returns {Ticket}
*/
  static new_zero_hop(destination: PublicKey, private_key: Uint8Array): Ticket;
/**
* Serializes the ticket except the signature
* @returns {Uint8Array}
*/
  serialize_unsigned(): Uint8Array;
/**
* Computes Ethereum signature hash of the ticket
* @returns {Hash}
*/
  get_hash(): Hash;
/**
* Computes a candidate check value to verify if this ticket is winning
* @param {Hash} preimage
* @param {Response} channel_response
* @returns {U256}
*/
  get_luck(preimage: Hash, channel_response: Response): U256;
/**
* Decides whether a ticket is a win or not.
* Note that this mimics the on-chain logic.
* Purpose of the function is to check the validity of ticket before we submit it to the blockchain.
* @param {Hash} preimage
* @param {Response} channel_response
* @param {U256} win_prob
* @returns {boolean}
*/
  is_winning(preimage: Hash, channel_response: Response, win_prob: U256): boolean;
/**
* Based on the price of this ticket, determines the path position (hop number) this ticket
* relates to.
* @param {U256} price_per_packet
* @param {U256} inverse_ticket_win_prob
* @returns {number}
*/
  get_path_position(price_per_packet: U256, inverse_ticket_win_prob: U256): number;
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
  constructor(counterparty: Address, challenge: EthereumChallenge, epoch: U256, index: U256, amount: Balance, win_prob: U256, channel_epoch: U256, signature: Signature);
/**
* @returns {PublicKey}
*/
  recover_signer(): PublicKey;
/**
* @param {PublicKey} public_key
* @returns {boolean}
*/
  verify(public_key: PublicKey): boolean;
/**
* @param {Uint8Array} bytes
* @returns {Ticket}
*/
  static deserialize(bytes: Uint8Array): Ticket;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @param {Ticket} other
* @returns {boolean}
*/
  eq(other: Ticket): boolean;
/**
* @returns {Ticket}
*/
  clone(): Ticket;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  amount: Balance;
/**
*/
  challenge: EthereumChallenge;
/**
*/
  channel_epoch: U256;
/**
*/
  counterparty: Address;
/**
*/
  epoch: U256;
/**
*/
  index: U256;
/**
*/
  signature?: Signature;
/**
*/
  win_prob: U256;
}
/**
* Represents the Ethereum's basic numeric type - unsigned 256-bit integer
*/
export class U256 {
  free(): void;
/**
* @param {string} value
*/
  constructor(value: string);
/**
* @returns {U256}
*/
  static zero(): U256;
/**
* @returns {U256}
*/
  static one(): U256;
/**
* @returns {number}
*/
  as_u32(): number;
/**
* @returns {bigint}
*/
  as_u64(): bigint;
/**
* @param {number} n
* @returns {U256}
*/
  addn(n: number): U256;
/**
* @param {number} n
* @returns {U256}
*/
  muln(n: number): U256;
/**
* @param {number} value
* @returns {U256}
*/
  static from(value: number): U256;
/**
* @param {Uint8Array} data
* @returns {U256}
*/
  static deserialize(data: Uint8Array): U256;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @returns {string}
*/
  to_hex(): string;
/**
* @param {U256} inverse_prob
* @returns {U256}
*/
  static from_inverse_probability(inverse_prob: U256): U256;
/**
* @returns {string}
*/
  to_string(): string;
/**
* @param {U256} other
* @returns {boolean}
*/
  eq(other: U256): boolean;
/**
* @param {U256} other
* @returns {number}
*/
  cmp(other: U256): number;
/**
* @returns {U256}
*/
  clone(): U256;
/**
* @returns {number}
*/
  static size(): number;
}
/**
* Wrapper for an unacknowledged ticket
*/
export class UnacknowledgedTicket {
  free(): void;
/**
* @param {Ticket} ticket
* @param {HalfKey} own_key
* @param {PublicKey} signer
*/
  constructor(ticket: Ticket, own_key: HalfKey, signer: PublicKey);
/**
* @returns {HalfKeyChallenge}
*/
  get_challenge(): HalfKeyChallenge;
/**
* @param {Uint8Array} data
* @returns {UnacknowledgedTicket}
*/
  static deserialize(data: Uint8Array): UnacknowledgedTicket;
/**
* @returns {Uint8Array}
*/
  serialize(): Uint8Array;
/**
* @param {HalfKey} acknowledgement
* @returns {Response}
*/
  get_response(acknowledgement: HalfKey): Response;
/**
* @param {HalfKey} acknowledgement
* @returns {boolean}
*/
  verify_challenge(acknowledgement: HalfKey): boolean;
/**
* @param {UnacknowledgedTicket} other
* @returns {boolean}
*/
  eq(other: UnacknowledgedTicket): boolean;
/**
* @returns {UnacknowledgedTicket}
*/
  clone(): UnacknowledgedTicket;
/**
* @returns {number}
*/
  static size(): number;
/**
*/
  own_key: HalfKey;
/**
*/
  signer: PublicKey;
/**
*/
  ticket: Ticket;
}
/**
*/
export class WasmVecAccountEntry {
  free(): void;
/**
* @returns {AccountEntry | undefined}
*/
  next(): AccountEntry | undefined;
}
/**
*/
export class WasmVecAcknowledgedTicket {
  free(): void;
/**
* @returns {AcknowledgedTicket | undefined}
*/
  next(): AcknowledgedTicket | undefined;
}
/**
*/
export class WasmVecChannelEntry {
  free(): void;
/**
* @returns {ChannelEntry | undefined}
*/
  next(): ChannelEntry | undefined;
}
/**
*/
export class WasmVecPublicKey {
  free(): void;
/**
* @returns {PublicKey | undefined}
*/
  next(): PublicKey | undefined;
}
