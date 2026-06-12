import { Binaries, CircuitArtifacts, CircuitNameString, CircuitsInterface, VersionString } from "./circuits.interface.js";
interface CircuitOptions {
    baseUrl?: string;
    browser?: boolean;
}
/**
 * Class representing circuit management and artifact handling.
 * Implements the CircuitsInterface.
 */
export declare class Circuits implements CircuitsInterface {
    /**
     * Indicates whether the circuits have been initialized.
     * @type {boolean}
     * @protected
     */
    protected initialized: boolean;
    /**
     * The version of the circuit artifacts being used.
     * @type {VersionString}
     * @protected
     */
    protected version: VersionString;
    /**
     * The binaries containing circuit artifacts such as wasm, vkey, and zkey files.
     * @type {Binaries}
     * @protected
     */
    protected binaries: Binaries;
    /**
     * The base URL for fetching circuit artifacts.
     * @type {string}
     * @protected
     */
    protected baseUrl: string;
    protected readonly browser: boolean;
    /**
     * Constructor to initialize the Circuits class with an optional custom base URL.
     * @param {string} [options.baseUrl] - The base URL for fetching circuit artifacts (optional).
     * @param {boolean} [options.browser] - Controls how the circuits will be loaded, using either `fetch` if true or `fs` otherwise. Defaults to true.
     */
    constructor(options?: CircuitOptions);
    /**
     * Determines whether the environment is a browser.
     * @returns {boolean} True if running in a browser environment, false otherwise.
     * @protected
     */
    _browser(): boolean;
    /**
     * Initializes the circuit manager with binaries and a version.
     * @param {Binaries} binaries - The binaries containing circuit artifacts.
     * @param {VersionString} version - The version of the circuit artifacts.
     * @protected
     */
    protected _initialize(binaries: Binaries, version: VersionString): void;
    /**
     * Handles initialization of circuit artifacts, fetching them if necessary.
     * @param {VersionString} [version=Version.latest] - The version of the circuit artifacts.
     * @throws {CircuitInitialization} If an error occurs during initialization.
     * @protected
     * @async
     */
    protected _handleInitialization(version?: VersionString): Promise<void>;
    /**
     * Fetches a versioned artifact from a given path.
     * @param {string} artifactPath - The path to the artifact.
     * @param {VersionString} version - The version of the artifact.
     * @returns {Promise<Uint8Array>} A promise that resolves to the artifact as a Uint8Array.
     * @throws {FetchArtifact} If the artifact cannot be fetched.
     * @protected
     * @async
     */
    _fetchVersionedArtifact(artifactPath: string): Promise<Uint8Array>;
    /**
     * Downloads and returns the circuit artifacts for a specific circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @returns {Promise<CircuitArtifacts>} A promise that resolves to the circuit artifacts.
     * @protected
     * @async
     */
    _downloadCircuitArtifacts(circuitName: CircuitNameString): Promise<CircuitArtifacts>;
    /**
     * Downloads all circuit artifacts for the specified version.
     * @param {VersionString} version - The version of the artifacts.
     * @returns {Promise<Binaries>} A promise that resolves to the binaries containing all circuit artifacts.
     * @async
     */
    downloadArtifacts(version: VersionString): Promise<Binaries>;
    /**
     * Initializes the circuit artifacts for the specified version.
     * @param {VersionString} version - The version of the artifacts.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @async
     */
    initArtifacts(version: VersionString): Promise<void>;
    /**
     * Retrieves the verification key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the verification key.
     * @async
     */
    getVerificationKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the proving key for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the proving key.
     * @async
     */
    getProvingKey(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
    /**
     * Retrieves the wasm file for a specified circuit.
     * @param {CircuitNameString} circuitName - The name of the circuit.
     * @param {VersionString} [version=Version.latest] - The version of the artifacts.
     * @returns {Promise<Uint8Array>} A promise that resolves to the wasm file.
     * @async
     */
    getWasm(circuitName: CircuitNameString, version?: VersionString): Promise<Uint8Array>;
}
export {};
