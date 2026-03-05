/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ikki_escrow.json`.
 */
export type IkkiEscrow = {
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
  "metadata": {
    "name": "ikkiEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Ikki platform on-chain escrow for competitive gaming duels"
  },
  "instructions": [
    {
      "name": "cancelEscrow",
      "docs": [
        "Player 1 cancels an open escrow (before anyone joins)."
      ],
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
                "account": "escrowAccount"
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
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "player1TokenAccount",
          "docs": [
            "Player 1's token account (receives refund)"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimExpired",
      "docs": [
        "Permissionless crank: anyone can claim an expired Open escrow to refund player1."
      ],
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
          "docs": [
            "Anyone can crank this — no signer constraint on identity"
          ],
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
                "account": "escrowAccount"
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
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "player1TokenAccount",
          "docs": [
            "Player 1's token account (receives refund)"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createEscrow",
      "docs": [
        "Player 1 creates an escrow and deposits their stake into the vault."
      ],
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
          "name": "tokenMint",
          "docs": [
            "The SPL token mint for the duel (e.g. SKR)"
          ]
        },
        {
          "name": "player1TokenAccount",
          "docs": [
            "Player 1's token account (source of stake)"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "PDA-owned vault to hold escrowed tokens"
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
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
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
      "docs": [
        "Authority marks an active escrow as disputed."
      ],
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
                "account": "escrowAccount"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializePlatform",
      "docs": [
        "One-time initialisation: create the singleton PlatformConfig."
      ],
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
      "docs": [
        "Player 2 joins the escrow and deposits their matching stake."
      ],
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
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "player2TokenAccount",
          "docs": [
            "Player 2's token account (source of stake)"
          ],
          "writable": true
        },
        {
          "name": "vault",
          "docs": [
            "The vault holding escrowed tokens"
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
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "resolveDispute",
      "docs": [
        "Authority resolves a disputed escrow: same payout logic as settle."
      ],
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
                "account": "escrowAccount"
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
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "winnerTokenAccount",
          "docs": [
            "Winner's token account"
          ],
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Treasury token account for fee"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "docs": [
        "Authority settles an active escrow: winner receives pot minus fee,",
        "treasury receives the fee."
      ],
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
          "docs": [
            "Platform authority (backend signer)"
          ],
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
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Vault holding the escrowed tokens"
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
                "kind": "account",
                "path": "escrow.duel_id",
                "account": "escrowAccount"
              }
            ]
          }
        },
        {
          "name": "winnerTokenAccount",
          "docs": [
            "Winner's token account to receive payout"
          ],
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Treasury token account to receive platform fee"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "docs": [
        "Update fee or treasury (authority only)."
      ],
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
      "name": "escrowAccount",
      "discriminator": [
        36,
        69,
        48,
        18,
        128,
        225,
        125,
        135
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
    }
  ],
  "types": [
    {
      "name": "escrowAccount",
      "docs": [
        "Per-duel escrow account. Seeds: [\"escrow\", duel_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "duelId",
            "docs": [
              "Matches the off-chain duel UUID (16 bytes)"
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "player1",
            "docs": [
              "Player 1 (creator) public key"
            ],
            "type": "pubkey"
          },
          {
            "name": "player2",
            "docs": [
              "Player 2 (joiner) public key — default (all zeros) when Open"
            ],
            "type": "pubkey"
          },
          {
            "name": "stakeAmount",
            "docs": [
              "Stake per player in token smallest units"
            ],
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "docs": [
              "SPL token mint address (e.g. SKR token)"
            ],
            "type": "pubkey"
          },
          {
            "name": "status",
            "docs": [
              "Current escrow lifecycle status"
            ],
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "winner",
            "docs": [
              "Winner public key — default (all zeros) until settled"
            ],
            "type": "pubkey"
          },
          {
            "name": "expiry",
            "docs": [
              "Unix timestamp after which an Open escrow can be reclaimed"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
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
      "docs": [
        "Singleton platform configuration. Seeds: [\"platform_config\"]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Admin / backend authority that can settle duels"
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Platform fee in basis points (e.g. 250 = 2.5%)"
            ],
            "type": "u16"
          },
          {
            "name": "treasury",
            "docs": [
              "Treasury wallet that receives platform fees"
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
