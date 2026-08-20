/**
 * GENERATED FILE — älä muokkaa käsin.
 *
 *   node tools/mirror-pacing.mjs
 *
 * Louhitut rytmiluvut (tools/pacing-stats.json) ja mitattu hyppybudjetti
 * (tools/jump-budget.json) siinä muodossa jonka selain osaa importata
 * synkronisesti. Ks. tools/mirror-pacing.mjs siitä miksi kopio on olemassa ja
 * mikä portti pitää sen samana kuin mittaus.
 */

export const PACING_STATS = {
  "note": "Aggregate pacing statistics only. No level layout is stored, derivable or shipped from this file. Regenerate with tools/mine-pacing.mjs.",
  "corpus": {
    "levels": 15,
    "columns": 2923
  },
  "gapWidth": {
    "n": 130,
    "mean": 2.65,
    "min": 1,
    "p25": 1,
    "median": 2,
    "p75": 3,
    "p90": 6,
    "max": 13,
    "histogram": {
      "1": 49,
      "2": 39,
      "3": 18,
      "4": 6,
      "5": 4,
      "6": 5,
      "7": 1,
      "8": 1,
      "9": 2,
      "10": 2,
      "11": 1,
      "13": 2
    }
  },
  "groundRun": {
    "n": 145,
    "mean": 17.78,
    "min": 1,
    "p25": 3,
    "median": 10,
    "p75": 23,
    "p90": 44,
    "max": 118,
    "histogram": {
      "1": 11,
      "2": 17,
      "3": 13,
      "4": 12,
      "5": 5,
      "6": 2,
      "7": 2,
      "8": 8,
      "9": 1,
      "10": 7,
      "11": 5,
      "12": 1,
      "13": 3,
      "14": 3,
      "15": 4,
      "16": 7,
      "17": 3,
      "18": 2,
      "19": 1,
      "20": 1,
      "23": 1,
      "24": 1,
      "25": 1,
      "26": 2,
      "27": 1,
      "30": 3,
      "33": 2,
      "35": 1,
      "36": 2,
      "37": 2,
      "38": 1,
      "39": 1,
      "40": 1,
      "43": 2,
      "44": 3,
      "47": 1,
      "48": 1,
      "50": 1,
      "64": 1,
      "66": 1,
      "69": 1,
      "76": 1,
      "77": 1,
      "80": 1,
      "85": 1,
      "92": 1,
      "111": 1,
      "118": 1
    }
  },
  "stepUp": {
    "n": 317,
    "mean": 2.59,
    "min": 1,
    "p25": 1,
    "median": 2,
    "p75": 4,
    "p90": 4,
    "max": 6,
    "histogram": {
      "1": 126,
      "2": 40,
      "3": 33,
      "4": 91,
      "5": 11,
      "6": 16
    }
  },
  "stepDown": {
    "n": 239,
    "mean": 3.41,
    "min": 1,
    "p25": 2,
    "median": 4,
    "p75": 4,
    "p90": 6,
    "max": 6,
    "histogram": {
      "1": 33,
      "2": 41,
      "3": 32,
      "4": 88,
      "5": 19,
      "6": 26
    }
  },
  "challengeSpacing": {
    "n": 564,
    "mean": 4.52,
    "min": 1,
    "p25": 2,
    "median": 3,
    "p75": 6,
    "p90": 10,
    "max": 32,
    "histogram": {
      "1": 137,
      "2": 89,
      "3": 73,
      "4": 55,
      "5": 45,
      "6": 43,
      "7": 21,
      "8": 28,
      "9": 12,
      "10": 12,
      "11": 13,
      "12": 9,
      "13": 7,
      "14": 1,
      "15": 7,
      "16": 1,
      "17": 3,
      "18": 3,
      "19": 1,
      "20": 1,
      "28": 1,
      "30": 1,
      "32": 1
    }
  },
  "introSafeColumns": {
    "n": 15,
    "mean": 11.13,
    "min": 5,
    "p25": 9,
    "median": 11,
    "p75": 14,
    "p90": 16,
    "max": 17,
    "histogram": {
      "5": 1,
      "8": 1,
      "9": 2,
      "10": 2,
      "11": 5,
      "14": 2,
      "16": 1,
      "17": 1
    }
  },
  "enemySpacing": {
    "n": 255,
    "mean": 7.9,
    "min": 1,
    "p25": 2,
    "median": 5,
    "p75": 10,
    "p90": 18,
    "max": 95,
    "histogram": {
      "1": 36,
      "2": 39,
      "3": 26,
      "4": 24,
      "5": 14,
      "6": 13,
      "7": 18,
      "8": 10,
      "9": 10,
      "10": 7,
      "11": 4,
      "12": 7,
      "13": 7,
      "14": 4,
      "15": 3,
      "16": 4,
      "17": 1,
      "18": 3,
      "19": 3,
      "20": 3,
      "24": 2,
      "25": 4,
      "26": 1,
      "28": 1,
      "29": 2,
      "30": 2,
      "31": 2,
      "33": 1,
      "42": 1,
      "44": 1,
      "45": 1,
      "95": 1
    }
  },
  "enemyCluster": {
    "n": 169,
    "mean": 1.6,
    "min": 1,
    "p25": 1,
    "median": 1,
    "p75": 2,
    "p90": 3,
    "max": 6,
    "histogram": {
      "1": 107,
      "2": 33,
      "3": 21,
      "4": 7,
      "6": 1
    }
  },
  "enemiesPer100": 9.24,
  "challengesPer100": 19.81,
  "blockRun": {
    "n": 226,
    "mean": 4.57,
    "min": 1,
    "p25": 1,
    "median": 2,
    "p75": 4,
    "p90": 8,
    "max": 132,
    "histogram": {
      "1": 86,
      "2": 45,
      "3": 30,
      "4": 20,
      "5": 14,
      "6": 6,
      "7": 2,
      "8": 4,
      "9": 1,
      "10": 1,
      "11": 2,
      "16": 3,
      "18": 3,
      "26": 1,
      "27": 2,
      "28": 3,
      "45": 1,
      "51": 1,
      "132": 1
    }
  },
  "blockHeightAboveFloor": {
    "n": 994,
    "mean": 3.83,
    "min": -5,
    "p25": 0,
    "median": 4,
    "p75": 7,
    "p90": 11,
    "max": 11,
    "histogram": {
      "0": 276,
      "1": 11,
      "2": 11,
      "3": 12,
      "4": 115,
      "5": 83,
      "6": 59,
      "7": 84,
      "8": 85,
      "9": 17,
      "10": 8,
      "11": 112,
      "-1": 52,
      "-2": 43,
      "-3": 20,
      "-4": 4,
      "-5": 2
    }
  },
  "rewardBlockShare": 0.098,
  "coinGroup": {
    "n": 75,
    "mean": 2.21,
    "min": 1,
    "p25": 1,
    "median": 2,
    "p75": 3,
    "p90": 4,
    "max": 10,
    "histogram": {
      "1": 27,
      "2": 27,
      "3": 10,
      "4": 8,
      "6": 1,
      "7": 1,
      "10": 1
    }
  },
  "pipeHeight": {
    "n": 85,
    "mean": 3.19,
    "min": 2,
    "p25": 2,
    "median": 3,
    "p75": 4,
    "p90": 4,
    "max": 7,
    "histogram": {
      "2": 26,
      "3": 28,
      "4": 25,
      "5": 3,
      "6": 1,
      "7": 2
    }
  },
  "levelWidth": {
    "n": 15,
    "mean": 194.87,
    "min": 149,
    "p25": 158,
    "median": 187,
    "p75": 202,
    "p90": 222,
    "max": 373,
    "histogram": {
      "149": 1,
      "150": 2,
      "158": 1,
      "165": 1,
      "176": 1,
      "184": 1,
      "187": 1,
      "197": 2,
      "198": 1,
      "202": 1,
      "215": 1,
      "222": 1,
      "373": 1
    }
  },
  "densityRampByQuarter": [
    17.4,
    24.8,
    20.4,
    14.9
  ],
  "vertical": {
    "note": "Aggregate climb pacing only, from the corpus's two vertical games. No layout is stored, derivable or shipped from this file. Regenerate with: VGLC_DIR=… node tools/mine-pacing.mjs --vertical",
    "corpus": {
      "games": [
        "Rainbow Islands (28)",
        "Kid Icarus (6)"
      ],
      "levels": 34,
      "rows": 6054
    },
    "rungRise": {
      "n": 1774,
      "mean": 3.59,
      "min": 1,
      "p25": 2,
      "median": 4,
      "p75": 5,
      "p90": 6,
      "max": 6,
      "histogram": {
        "1": 188,
        "2": 306,
        "3": 382,
        "4": 347,
        "5": 265,
        "6": 286
      }
    },
    "rungShift": {
      "n": 1774,
      "mean": 1.51,
      "min": 0,
      "p25": 0,
      "median": 0,
      "p75": 3,
      "p90": 5,
      "max": 6,
      "histogram": {
        "0": 929,
        "1": 155,
        "2": 193,
        "3": 139,
        "4": 160,
        "5": 108,
        "6": 90
      }
    },
    "rungWidth": {
      "n": 2341,
      "mean": 6.04,
      "min": 1,
      "p25": 2,
      "median": 4,
      "p75": 7,
      "p90": 12,
      "max": 32,
      "histogram": {
        "1": 187,
        "2": 573,
        "3": 198,
        "4": 450,
        "5": 91,
        "6": 223,
        "7": 62,
        "8": 151,
        "9": 32,
        "10": 74,
        "11": 19,
        "12": 49,
        "13": 19,
        "14": 34,
        "15": 11,
        "16": 40,
        "17": 3,
        "18": 9,
        "19": 1,
        "20": 4,
        "21": 2,
        "22": 8,
        "24": 5,
        "25": 2,
        "26": 10,
        "27": 3,
        "28": 1,
        "30": 1,
        "31": 2,
        "32": 77
      }
    },
    "waysOn": {
      "n": 2341,
      "mean": 1.61,
      "min": 0,
      "p25": 1,
      "median": 1,
      "p75": 2,
      "p90": 4,
      "max": 8,
      "histogram": {
        "0": 567,
        "1": 652,
        "2": 588,
        "3": 297,
        "4": 167,
        "5": 52,
        "6": 12,
        "7": 5,
        "8": 1
      }
    },
    "twoWaysShare": 0.479,
    "deadEndShare": 0.242,
    "rungsPer100Rows": 38.67
  }
};

export const JUMP_BUDGET = {
  "note": "Measured by tools/measure-jump.mjs. Regenerate after touching physics.",
  "margin": 0.7,
  "cases": [
    {
      "label": "standing, tapped",
      "speed": 0,
      "height": 21,
      "distance": 0,
      "frames": 22
    },
    {
      "label": "standing, held",
      "speed": 0,
      "height": 71,
      "distance": 0,
      "frames": 53
    },
    {
      "label": "walking, held",
      "speed": 1.5,
      "height": 78,
      "distance": 87,
      "frames": 57
    },
    {
      "label": "running, held",
      "speed": 2.5,
      "height": 85,
      "distance": 155,
      "frames": 61
    },
    {
      "label": "P-speed, held",
      "speed": 3.5,
      "height": 100,
      "distance": 245,
      "frames": 69
    },
    {
      "label": "running + fart jump",
      "speed": 2.5,
      "height": 190,
      "distance": 310,
      "frames": 123
    }
  ],
  "gapTiles": 6,
  "softGapTiles": 10,
  "wallTiles": 4
};
