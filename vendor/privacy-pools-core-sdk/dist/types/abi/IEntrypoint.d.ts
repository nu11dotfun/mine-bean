export declare const IEntrypointABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "receive";
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "DEFAULT_ADMIN_ROLE";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "UPGRADE_INTERFACE_VERSION";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "assetConfig";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }];
    readonly outputs: readonly [{
        readonly name: "pool";
        readonly type: "address";
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "minimumDepositAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "vettingFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "maxRelayFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "associationSets";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "root";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "ipfsCID";
        readonly type: "string";
        readonly internalType: "string";
    }, {
        readonly name: "timestamp";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "deposit";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_value";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_precommitment";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "_commitment";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "deposit";
    readonly inputs: readonly [{
        readonly name: "_precommitment";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "_commitment";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "getRoleAdmin";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "grantRole";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "hasRole";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "initialize";
    readonly inputs: readonly [{
        readonly name: "_owner";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "_postman";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "latestRoot";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "_root";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "proxiableUUID";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "registerPool";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_pool";
        readonly type: "address";
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "_minimumDepositAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_vettingFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_maxRelayFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "relay";
    readonly inputs: readonly [{
        readonly name: "_withdrawal";
        readonly type: "tuple";
        readonly internalType: "struct IPrivacyPool.Withdrawal";
        readonly components: readonly [{
            readonly name: "processooor";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "data";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }, {
        readonly name: "_proof";
        readonly type: "tuple";
        readonly internalType: "struct ProofLib.WithdrawProof";
        readonly components: readonly [{
            readonly name: "pA";
            readonly type: "uint256[2]";
            readonly internalType: "uint256[2]";
        }, {
            readonly name: "pB";
            readonly type: "uint256[2][2]";
            readonly internalType: "uint256[2][2]";
        }, {
            readonly name: "pC";
            readonly type: "uint256[2]";
            readonly internalType: "uint256[2]";
        }, {
            readonly name: "pubSignals";
            readonly type: "uint256[8]";
            readonly internalType: "uint256[8]";
        }];
    }, {
        readonly name: "_scope";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "removePool";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "renounceRole";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "callerConfirmation";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "revokeRole";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "rootByIndex";
    readonly inputs: readonly [{
        readonly name: "_index";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "_root";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "scopeToPool";
    readonly inputs: readonly [{
        readonly name: "_scope";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly internalType: "contract IPrivacyPool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "supportsInterface";
    readonly inputs: readonly [{
        readonly name: "interfaceId";
        readonly type: "bytes4";
        readonly internalType: "bytes4";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "updatePoolConfiguration";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_minimumDepositAmount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_vettingFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_maxRelayFeeBPS";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "updateRoot";
    readonly inputs: readonly [{
        readonly name: "_root";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "_ipfsCID";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly outputs: readonly [{
        readonly name: "_index";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "upgradeToAndCall";
    readonly inputs: readonly [{
        readonly name: "newImplementation";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "data";
        readonly type: "bytes";
        readonly internalType: "bytes";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "payable";
}, {
    readonly type: "function";
    readonly name: "windDownPool";
    readonly inputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly internalType: "contract IPrivacyPool";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "withdrawFees";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_recipient";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "Deposited";
    readonly inputs: readonly [{
        readonly name: "_depositor";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "_pool";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "_commitment";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "_amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "FeesWithdrawn";
    readonly inputs: readonly [{
        readonly name: "_asset";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_recipient";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "address";
    }, {
        readonly name: "_amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Initialized";
    readonly inputs: readonly [{
        readonly name: "version";
        readonly type: "uint64";
        readonly indexed: false;
        readonly internalType: "uint64";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PoolConfigurationUpdated";
    readonly inputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "_asset";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_newMinimumDepositAmount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "_newVettingFeeBPS";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "_newMaxRelayFeeBPS";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PoolRegistered";
    readonly inputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "_asset";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_scope";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PoolRemoved";
    readonly inputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IPrivacyPool";
    }, {
        readonly name: "_asset";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_scope";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PoolWindDown";
    readonly inputs: readonly [{
        readonly name: "_pool";
        readonly type: "address";
        readonly indexed: false;
        readonly internalType: "contract IPrivacyPool";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RoleAdminChanged";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "previousAdminRole";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "newAdminRole";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RoleGranted";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "account";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RoleRevoked";
    readonly inputs: readonly [{
        readonly name: "role";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "account";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "RootUpdated";
    readonly inputs: readonly [{
        readonly name: "_root";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "_ipfsCID";
        readonly type: "string";
        readonly indexed: false;
        readonly internalType: "string";
    }, {
        readonly name: "_timestamp";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Upgraded";
    readonly inputs: readonly [{
        readonly name: "implementation";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "WithdrawalRelayed";
    readonly inputs: readonly [{
        readonly name: "_relayer";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "_recipient";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "_asset";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "contract IERC20";
    }, {
        readonly name: "_amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "_feeAmount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AccessControlBadConfirmation";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AccessControlUnauthorizedAccount";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "neededRole";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
}, {
    readonly type: "error";
    readonly name: "AddressEmptyCode";
    readonly inputs: readonly [{
        readonly name: "target";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "AssetMismatch";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AssetPoolAlreadyRegistered";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ERC1967InvalidImplementation";
    readonly inputs: readonly [{
        readonly name: "implementation";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ERC1967NonPayable";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "EmptyRoot";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "FailedCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidEntrypointForPool";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidFeeBPS";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidIPFSCIDLength";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidIndex";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidInitialization";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidPoolState";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidProcessooor";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidWithdrawalAmount";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "MinimumDepositAmount";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NativeAssetNotAccepted";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NativeAssetTransferFailed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NoRootsAvailable";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotInitializing";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "PoolIsDead";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "PoolNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "ReentrancyGuardReentrantCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "RelayFeeGreaterThanMax";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SafeERC20FailedOperation";
    readonly inputs: readonly [{
        readonly name: "token";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ScopePoolAlreadyRegistered";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "UUPSUnauthorizedCallContext";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "UUPSUnsupportedProxiableUUID";
    readonly inputs: readonly [{
        readonly name: "slot";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
}, {
    readonly type: "error";
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}];
