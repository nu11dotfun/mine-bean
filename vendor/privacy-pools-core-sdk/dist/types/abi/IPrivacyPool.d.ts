export declare const IPrivacyPoolABI: ({
    type: string;
    name: string;
    inputs: {
        name: string;
        type: string;
        internalType: string;
    }[];
    outputs: {
        name: string;
        type: string;
        internalType: string;
    }[];
    stateMutability: string;
    anonymous?: undefined;
} | {
    type: string;
    name: string;
    inputs: {
        name: string;
        type: string;
        internalType: string;
        components: {
            name: string;
            type: string;
            internalType: string;
        }[];
    }[];
    outputs: never[];
    stateMutability: string;
    anonymous?: undefined;
} | {
    type: string;
    name: string;
    inputs: {
        name: string;
        type: string;
        indexed: boolean;
        internalType: string;
    }[];
    anonymous: boolean;
    outputs?: undefined;
    stateMutability?: undefined;
} | {
    type: string;
    name: string;
    inputs: never[];
    outputs?: undefined;
    stateMutability?: undefined;
    anonymous?: undefined;
})[];
