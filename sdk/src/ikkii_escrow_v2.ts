/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ikkii_escrow_v2.json`.
 */
export type IkkiiEscrowV2 = {
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
  "metadata": {
    "name": "ikkiiEscrowV2",
    "version": "0.2.0",
    "spec": "0.1.0",
    "description": "Ikkii platform on-chain escrow v2 — NFT + Token-2022 support"
  },
  "instructions": [
    {
      "name": "cancelEscrow",
      "discriminator": [
        156,
        203,
        54,
        179,
        38,
        72,
        33,
        21
      ],
      "accounts": [
        {
          "name": "player1",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "player1TokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "claimExpired",
      "discriminator": [
        124,
        78,
        197,
        187,
        210,
        66,
        255,
        1
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "player1TokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "claimExpiredActive",
      "discriminator": [
        73,
        70,
        137,
        1,
        14,
        34,
        117,
        7
      ],
      "accounts": [
        {
          "name": "cranker",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "player1TokenAccount",
          "writable": true
        },
        {
          "name": "player2TokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createEscrow",
      "discriminator": [
        253,
        215,
        165,
        116,
        36,
        108,
        68,
        80
      ],
      "accounts": [
        {
          "name": "player1",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "duelId"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "player1TokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Vault PDA — created and initialized manually in the instruction"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "duelId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token program: SPL Token or Token-2022"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "duelId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "stakeAmount",
          "type": "u64"
        },
        {
          "name": "expiry",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createNftEscrow",
      "discriminator": [
        221,
        77,
        204,
        186,
        69,
        47,
        25,
        106
      ],
      "accounts": [
        {
          "name": "player1",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "duelId"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "player1TokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "Vault PDA — created and initialized manually in the instruction"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "duelId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token program: SPL Token or Token-2022"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "duelId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "stakeAmount",
          "type": "u64"
        },
        {
          "name": "expiry",
          "type": "i64"
        }
      ]
    },
    {
      "name": "disputeEscrow",
      "discriminator": [
        198,
        174,
        139,
        70,
        87,
        79,
        181,
        139
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platformConfig"
          ]
        },
        {
          "name": "platformConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializePlatform",
      "discriminator": [
        119,
        201,
        101,
        45,
        75,
        122,
        89,
        3
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "joinEscrow",
      "discriminator": [
        205,
        250,
        117,
        19,
        126,
        211,
        205,
        103
      ],
      "accounts": [
        {
          "name": "player2",
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "player2TokenAccount",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platformConfig"
          ]
        },
        {
          "name": "platformConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "winnerTokenAccount",
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "settleEscrow",
      "discriminator": [
        22,
        135,
        160,
        194,
        23,
        186,
        124,
        110
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platformConfig"
          ]
        },
        {
          "name": "platformConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccountV2"
              }
            ]
          }
        },
        {
          "name": "winnerTokenAccount",
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updatePlatform",
      "discriminator": [
        46,
        78,
        138,
        189,
        47,
        163,
        120,
        85
      ],
      "accounts": [
        {
          "name": "platformConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "platformConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "newFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newTreasury",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrowAccountV2",
      "discriminator": [
        183,
        99,
        147,
        83,
        8,
        97,
        77,
        9
      ]
    },
    {
      "name": "platformConfig",
      "discriminator": [
        160,
        78,
        128,
        0,
        248,
        83,
        230,
        160
      ]
    }
  ],
  "events": [
    {
      "name": "escrowCancelled",
      "discriminator": [
        98,
        241,
        195,
        122,
        213,
        0,
        162,
        161
      ]
    },
    {
      "name": "escrowCreated",
      "discriminator": [
        70,
        127,
        105,
        102,
        92,
        97,
        7,
        173
      ]
    },
    {
      "name": "escrowDisputed",
      "discriminator": [
        132,
        73,
        81,
        200,
        177,
        51,
        128,
        18
      ]
    },
    {
      "name": "escrowJoined",
      "discriminator": [
        175,
        173,
        48,
        61,
        222,
        19,
        126,
        85
      ]
    },
    {
      "name": "escrowResolved",
      "discriminator": [
        91,
        111,
        193,
        4,
        183,
        36,
        78,
        31
      ]
    },
    {
      "name": "escrowSettled",
      "discriminator": [
        97,
        27,
        150,
        55,
        203,
        179,
        173,
        23
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the platform authority can perform this action"
    },
    {
      "code": 6001,
      "name": "invalidStatus",
      "msg": "Invalid escrow status for this operation"
    },
    {
      "code": 6002,
      "name": "selfDuel",
      "msg": "A player cannot duel themselves"
    },
    {
      "code": 6003,
      "name": "escrowExpired",
      "msg": "This escrow has expired"
    },
    {
      "code": 6004,
      "name": "notExpired",
      "msg": "This escrow has not expired yet"
    },
    {
      "code": 6005,
      "name": "invalidStakeAmount",
      "msg": "Stake amount must be greater than zero"
    },
    {
      "code": 6006,
      "name": "invalidWinner",
      "msg": "Winner must be one of the duel participants"
    },
    {
      "code": 6007,
      "name": "feeTooHigh",
      "msg": "Platform fee exceeds maximum allowed"
    },
    {
      "code": 6008,
      "name": "mintMismatch",
      "msg": "Token mint does not match the escrow"
    },
    {
      "code": 6009,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6010,
      "name": "expiryInPast",
      "msg": "Expiry timestamp must be in the future"
    },
    {
      "code": 6011,
      "name": "expiryTooFar",
      "msg": "Expiry timestamp is too far in the future (max 30 days)"
    },
    {
      "code": 6012,
      "name": "invalidTreasury",
      "msg": "Invalid treasury address"
    },
    {
      "code": 6013,
      "name": "invalidTokenProgram",
      "msg": "Token program must be SPL Token or Token-2022"
    },
    {
      "code": 6014,
      "name": "notAnNft",
      "msg": "Mint is not a valid NFT (supply must be 1, decimals must be 0)"
    }
  ],
  "types": [
    {
      "name": "escrowAccountV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "player1",
            "type": "pubkey"
          },
          {
            "name": "player2",
            "type": "pubkey"
          },
          {
            "name": "stakeAmount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "expiry",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "isNft",
            "type": "bool"
          },
          {
            "name": "tokenProgramId",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "escrowCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          },
          {
            "name": "refundedAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          },
          {
            "name": "player1",
            "type": "pubkey"
          },
          {
            "name": "stakeAmount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "isNft",
            "type": "bool"
          },
          {
            "name": "expiry",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowDisputed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "escrowJoined",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          },
          {
            "name": "player2",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "escrowResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "isNft",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "escrowSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "isNft",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "escrowStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "active"
          },
          {
            "name": "disputed"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "platformConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
