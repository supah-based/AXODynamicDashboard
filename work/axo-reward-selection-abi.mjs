// Read-only compact full-layout ABI from Based.bid’s published client.
// https://trade.based.bid/assets/readV4PoolHooksFromPositionManager-CEv_BYn4.js
// Pinned to the exact AXO hook runtime hash by axo-reward-selection.mjs.
export const rewardHookAbi = [
  {
    "inputs": [
      {
        "internalType": "IBasedBidHookFull.PoolId",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "getPoolFullConfig",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "poolOwner",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "hookFeeBpsBuy",
            "type": "uint24"
          },
          {
            "internalType": "uint24",
            "name": "hookFeeBpsSell",
            "type": "uint24"
          },
          {
            "internalType": "bool",
            "name": "projectTokenIsCurrency1",
            "type": "bool"
          },
          {
            "internalType": "IBasedBidHook.FeeKind",
            "name": "feeKind",
            "type": "uint8"
          },
          {
            "internalType": "uint24",
            "name": "penaltyFeeBps",
            "type": "uint24"
          },
          {
            "internalType": "uint48",
            "name": "launchTimestamp",
            "type": "uint48"
          },
          {
            "internalType": "uint48",
            "name": "whitelistPeriod",
            "type": "uint48"
          },
          {
            "internalType": "uint24",
            "name": "pendingHookFeeBps",
            "type": "uint24"
          },
          {
            "internalType": "uint32",
            "name": "lastAutoTuneTs",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "cooldownSeconds",
            "type": "uint32"
          },
          {
            "internalType": "uint256",
            "name": "maxBuyPerOrigin",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isWhitelistPool",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "isExternalFeeTrigger",
            "type": "bool"
          },
          {
            "internalType": "uint16",
            "name": "maxConversionSlippageBps",
            "type": "uint16"
          },
          {
            "internalType": "address",
            "name": "referral",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "maxBuyPerOriginForWhitelistedUser",
            "type": "uint256"
          }
        ],
        "internalType": "struct IBasedBidHook.PoolConfig",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint16",
            "name": "liquidityFeeBps",
            "type": "uint16"
          },
          {
            "internalType": "uint16",
            "name": "buybackFeeBps",
            "type": "uint16"
          },
          {
            "internalType": "uint16",
            "name": "rewardFeeBps",
            "type": "uint16"
          },
          {
            "internalType": "address[]",
            "name": "customWallets",
            "type": "address[]"
          },
          {
            "internalType": "uint16[]",
            "name": "customWalletBps",
            "type": "uint16[]"
          },
          {
            "internalType": "string[]",
            "name": "customWalletLabels",
            "type": "string[]"
          },
          {
            "components": [
              {
                "internalType": "bool",
                "name": "isSwapAll",
                "type": "bool"
              },
              {
                "internalType": "uint8",
                "name": "swapForRewardNo",
                "type": "uint8"
              },
              {
                "internalType": "uint16[]",
                "name": "RWAPercentsBps",
                "type": "uint16[]"
              },
              {
                "components": [
                  {
                    "components": [
                      {
                        "internalType": "IBasedBidHookFull.Currency",
                        "name": "currency0",
                        "type": "address"
                      },
                      {
                        "internalType": "IBasedBidHookFull.Currency",
                        "name": "currency1",
                        "type": "address"
                      },
                      {
                        "internalType": "uint24",
                        "name": "fee",
                        "type": "uint24"
                      },
                      {
                        "internalType": "int24",
                        "name": "tickSpacing",
                        "type": "int24"
                      },
                      {
                        "internalType": "address",
                        "name": "hooks",
                        "type": "address"
                      }
                    ],
                    "internalType": "struct IBasedBidHookFull.PoolKey[]",
                    "name": "hops",
                    "type": "tuple[]"
                  }
                ],
                "internalType": "struct IBasedBidHookFull.RewardPath[]",
                "name": "paths",
                "type": "tuple[]"
              }
            ],
            "internalType": "struct IBasedBidHookFull.RWASwapConfig[]",
            "name": "customWalletSwapConfigs",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct IBasedBidHook.HookFeeDistributionConfig",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint24",
            "name": "minBaseFeeBpsBuy",
            "type": "uint24"
          },
          {
            "internalType": "uint24",
            "name": "minBaseFeeBpsSell",
            "type": "uint24"
          },
          {
            "internalType": "uint24",
            "name": "maxBaseFeeBpsBuy",
            "type": "uint24"
          },
          {
            "internalType": "uint24",
            "name": "maxBaseFeeBpsSell",
            "type": "uint24"
          },
          {
            "internalType": "uint32",
            "name": "baseFeeFactorBuy",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "baseFeeFactorSell",
            "type": "uint32"
          },
          {
            "internalType": "uint24",
            "name": "defaultBaseFeeBpsBuy",
            "type": "uint24"
          },
          {
            "internalType": "uint24",
            "name": "defaultBaseFeeBpsSell",
            "type": "uint24"
          },
          {
            "internalType": "uint32",
            "name": "surgeDecayPeriodSeconds",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "surgeMultiplierPpm",
            "type": "uint32"
          },
          {
            "internalType": "bool",
            "name": "perSwapMode",
            "type": "bool"
          },
          {
            "internalType": "uint32",
            "name": "capAutoTuneStepPpm",
            "type": "uint32"
          },
          {
            "internalType": "uint32",
            "name": "capAutoTuneIntervalSeconds",
            "type": "uint32"
          }
        ],
        "internalType": "struct IBasedBidHook.DynamicFeeConfig",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint24",
            "name": "maxTicksPerBlock",
            "type": "uint24"
          },
          {
            "internalType": "uint40",
            "name": "capStartTime",
            "type": "uint40"
          },
          {
            "internalType": "bool",
            "name": "inCap",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "capTickDirectionPositive",
            "type": "bool"
          },
          {
            "internalType": "uint64",
            "name": "capFreq",
            "type": "uint64"
          },
          {
            "internalType": "uint48",
            "name": "lastCapFreqTs",
            "type": "uint48"
          },
          {
            "internalType": "int24",
            "name": "blockInitialTick",
            "type": "int24"
          },
          {
            "internalType": "uint64",
            "name": "lastCapEventBlock",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "lastObservationBlock",
            "type": "uint64"
          }
        ],
        "internalType": "struct IBasedBidHook.DynamicFeeState",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint32",
            "name": "volumeIntervalSeconds",
            "type": "uint32"
          },
          {
            "internalType": "uint256[]",
            "name": "volumeLevels",
            "type": "uint256[]"
          },
          {
            "internalType": "uint16[]",
            "name": "volumeMultiplierBps",
            "type": "uint16[]"
          }
        ],
        "internalType": "struct IBasedBidHook.VolumeConfig",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint48",
            "name": "lastVolumeTs",
            "type": "uint48"
          },
          {
            "internalType": "uint256",
            "name": "volumeRecorded",
            "type": "uint256"
          },
          {
            "internalType": "uint16",
            "name": "activeVolumeMultiplierBps",
            "type": "uint16"
          }
        ],
        "internalType": "struct IBasedBidHook.VolumeState",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint16[]",
            "name": "buyFeesBps",
            "type": "uint16[]"
          },
          {
            "internalType": "uint16[]",
            "name": "sellFeesBps",
            "type": "uint16[]"
          },
          {
            "internalType": "uint256[]",
            "name": "buyFeeTierAmountLevels",
            "type": "uint256[]"
          },
          {
            "internalType": "uint256[]",
            "name": "sellFeeTierAmountLevels",
            "type": "uint256[]"
          }
        ],
        "internalType": "struct IBasedBidHook.TieredFeeConfig",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "uint128",
            "name": "adminFeeAmount",
            "type": "uint128"
          },
          {
            "internalType": "uint128",
            "name": "referralFeeAmount",
            "type": "uint128"
          },
          {
            "internalType": "uint256",
            "name": "totalFeeAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "feeThreshold",
            "type": "uint256"
          }
        ],
        "internalType": "struct IBasedBidHook.PendingFees",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "bool",
            "name": "isSwapAll",
            "type": "bool"
          },
          {
            "internalType": "uint8",
            "name": "swapForRewardNo",
            "type": "uint8"
          },
          {
            "internalType": "uint16[]",
            "name": "RWAPercentsBps",
            "type": "uint16[]"
          },
          {
            "components": [
              {
                "components": [
                  {
                    "internalType": "IBasedBidHookFull.Currency",
                    "name": "currency0",
                    "type": "address"
                  },
                  {
                    "internalType": "IBasedBidHookFull.Currency",
                    "name": "currency1",
                    "type": "address"
                  },
                  {
                    "internalType": "uint24",
                    "name": "fee",
                    "type": "uint24"
                  },
                  {
                    "internalType": "int24",
                    "name": "tickSpacing",
                    "type": "int24"
                  },
                  {
                    "internalType": "address",
                    "name": "hooks",
                    "type": "address"
                  }
                ],
                "internalType": "struct IBasedBidHookFull.PoolKey[]",
                "name": "hops",
                "type": "tuple[]"
              }
            ],
            "internalType": "struct IBasedBidHookFull.RewardPath[]",
            "name": "paths",
            "type": "tuple[]"
          }
        ],
        "internalType": "struct IBasedBidHookFull.RWASwapConfig",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
