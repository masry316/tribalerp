import type { BuildingDef, UnitKey } from '../types';

export const BUILDINGS_DATA: Record<string, BuildingDef> = {
  "الخشاب": {
    name: "الخشاب",
    max_lvl: 30,
    btype: "mine",
    col_title: "الإنتاج/س (والسكان)",
    levels: [
      { lvl: 1, wood: 50, clay: 60, iron: 40, pop: "5 / 5", prod: 30, prop: "30/س" },
      { lvl: 2, wood: 63, clay: 77, iron: 50, pop: "1 / 6", prod: 35, prop: "35/س" },
      { lvl: 3, wood: 78, clay: 98, iron: 62, pop: "1 / 7", prod: 41, prop: "41/س" },
      { lvl: 4, wood: 98, clay: 124, iron: 77, pop: "1 / 8", prod: 47, prop: "47/س" },
      { lvl: 5, wood: 122, clay: 159, iron: 96, pop: "1 / 9", prod: 55, prop: "55/س" },
      { lvl: 6, wood: 153, clay: 202, iron: 120, pop: "1 / 10", prod: 64, prop: "64/س" },
      { lvl: 7, wood: 191, clay: 258, iron: 149, pop: "2 / 12", prod: 74, prop: "74/س" },
      { lvl: 8, wood: 238, clay: 329, iron: 185, pop: "2 / 14", prod: 86, prop: "86/س" },
      { lvl: 9, wood: 298, clay: 419, iron: 231, pop: "2 / 16", prod: 100, prop: "100/س" },
      { lvl: 10, wood: 373, clay: 534, iron: 287, pop: "2 / 18", prod: 117, prop: "117/س" },
      { lvl: 11, wood: 466, clay: 681, iron: 358, pop: "3 / 21", prod: 136, prop: "136/س" },
      { lvl: 12, wood: 582, clay: 868, iron: 446, pop: "3 / 24", prod: 158, prop: "158/س" },
      { lvl: 13, wood: 728, clay: 1107, iron: 555, pop: "4 / 28", prod: 184, prop: "184/س" },
      { lvl: 14, wood: 909, clay: 1412, iron: 691, pop: "5 / 33", prod: 214, prop: "214/س" },
      { lvl: 15, wood: 1137, clay: 1800, iron: 860, pop: "5 / 38", prod: 249, prop: "249/س" },
      { lvl: 16, wood: 1421, clay: 2295, iron: 1071, pop: "5 / 43", prod: 289, prop: "289/س" },
      { lvl: 17, wood: 1776, clay: 2926, iron: 1333, pop: "7 / 50", prod: 337, prop: "337/س" },
      { lvl: 18, wood: 2220, clay: 3731, iron: 1659, pop: "8 / 58", prod: 391, prop: "391/س" },
      { lvl: 19, wood: 2776, clay: 4757, iron: 2066, pop: "9 / 67", prod: 455, prop: "455/س" },
      { lvl: 20, wood: 3469, clay: 6065, iron: 2572, pop: "10 / 77", prod: 530, prop: "530/س" },
      { lvl: 21, wood: 4337, clay: 7733, iron: 3202, pop: "12 / 89", prod: 616, prop: "616/س" },
      { lvl: 22, wood: 5421, clay: 9860, iron: 3987, pop: "14 / 103", prod: 717, prop: "717/س" },
      { lvl: 23, wood: 6776, clay: 12571, iron: 4963, pop: "16 / 119", prod: 833, prop: "833/س" },
      { lvl: 24, wood: 8470, clay: 16028, iron: 6180, pop: "19 / 138", prod: 969, prop: "969/س" },
      { lvl: 25, wood: 10588, clay: 20436, iron: 7694, pop: "21 / 159", prod: 1127, prop: "1,127/س" },
      { lvl: 26, wood: 13235, clay: 26056, iron: 9578, pop: "24 / 183", prod: 1311, prop: "1,311/س" },
      { lvl: 27, wood: 16544, clay: 33221, iron: 11925, pop: "29 / 212", prod: 1525, prop: "1,525/س" },
      { lvl: 28, wood: 20680, clay: 42357, iron: 14847, pop: "33 / 245", prod: 1774, prop: "1,774/س" },
      { lvl: 29, wood: 25849, clay: 54005, iron: 18484, pop: "38 / 283", prod: 2063, prop: "2,063/س" },
      { lvl: 30, wood: 32312, clay: 68857, iron: 23013, pop: "43 / 326", prod: 2400, prop: "2,400/س" }
    ]
  },
  "حفرة الطمي": {
    name: "حفرة الطمي",
    max_lvl: 30,
    btype: "mine",
    col_title: "الإنتاج/س (والسكان)",
    levels: [
      { lvl: 1, wood: 65, clay: 50, iron: 40, pop: "10 / 10", prod: 30, prop: "30/س" },
      { lvl: 2, wood: 83, clay: 63, iron: 50, pop: "1 / 11", prod: 35, prop: "35/س" },
      { lvl: 3, wood: 105, clay: 80, iron: 62, pop: "2 / 13", prod: 41, prop: "41/س" },
      { lvl: 4, wood: 133, clay: 101, iron: 76, pop: "2 / 15", prod: 47, prop: "47/س" },
      { lvl: 5, wood: 169, clay: 128, iron: 95, pop: "2 / 17", prod: 55, prop: "55/س" },
      { lvl: 6, wood: 215, clay: 162, iron: 117, pop: "2 / 19", prod: 64, prop: "64/س" },
      { lvl: 7, wood: 273, clay: 205, iron: 145, pop: "3 / 22", prod: 74, prop: "74/س" },
      { lvl: 8, wood: 346, clay: 259, iron: 180, pop: "3 / 25", prod: 86, prop: "86/س" },
      { lvl: 9, wood: 440, clay: 328, iron: 224, pop: "4 / 29", prod: 100, prop: "100/س" },
      { lvl: 10, wood: 559, clay: 415, iron: 277, pop: "4 / 33", prod: 117, prop: "117/س" },
      { lvl: 11, wood: 709, clay: 525, iron: 344, pop: "4 / 37", prod: 136, prop: "136/س" },
      { lvl: 12, wood: 901, clay: 664, iron: 426, pop: "5 / 42", prod: 158, prop: "158/س" },
      { lvl: 13, wood: 1144, clay: 840, iron: 529, pop: "6 / 48", prod: 184, prop: "184/س" },
      { lvl: 14, wood: 1453, clay: 1062, iron: 655, pop: "7 / 55", prod: 214, prop: "214/س" },
      { lvl: 15, wood: 1846, clay: 1343, iron: 813, pop: "8 / 63", prod: 249, prop: "249/س" },
      { lvl: 16, wood: 2344, clay: 1700, iron: 1008, pop: "8 / 71", prod: 289, prop: "289/س" },
      { lvl: 17, wood: 2977, clay: 2150, iron: 1250, pop: "10 / 81", prod: 337, prop: "337/س" },
      { lvl: 18, wood: 3781, clay: 2720, iron: 1550, pop: "12 / 93", prod: 391, prop: "391/س" },
      { lvl: 19, wood: 4802, clay: 3440, iron: 1922, pop: "13 / 106", prod: 455, prop: "455/س" },
      { lvl: 20, wood: 6098, clay: 4352, iron: 2383, pop: "15 / 121", prod: 530, prop: "530/س" },
      { lvl: 21, wood: 7744, clay: 5505, iron: 2955, pop: "16 / 137", prod: 616, prop: "616/س" },
      { lvl: 22, wood: 9835, clay: 6964, iron: 3664, pop: "20 / 157", prod: 717, prop: "717/س" },
      { lvl: 23, wood: 12491, clay: 8810, iron: 4543, pop: "22 / 179", prod: 833, prop: "833/س" },
      { lvl: 24, wood: 15863, clay: 11144, iron: 5633, pop: "25 / 204", prod: 969, prop: "969/س" },
      { lvl: 25, wood: 20147, clay: 14098, iron: 6985, pop: "28 / 232", prod: 1127, prop: "1,127/س" },
      { lvl: 26, wood: 25586, clay: 17833, iron: 8662, pop: "33 / 265", prod: 1311, prop: "1,311/س" },
      { lvl: 27, wood: 32495, clay: 22559, iron: 10740, pop: "37 / 302", prod: 1525, prop: "1,525/س" },
      { lvl: 28, wood: 41268, clay: 28537, iron: 13318, pop: "42 / 344", prod: 1774, prop: "1,774/س" },
      { lvl: 29, wood: 52410, clay: 36100, iron: 16515, pop: "48 / 392", prod: 2063, prop: "2,063/س" },
      { lvl: 30, wood: 66561, clay: 45666, iron: 20478, pop: "55 / 447", prod: 2400, prop: "2,400/س" }
    ]
  },
  "منجم الحديد": {
    name: "منجم الحديد",
    max_lvl: 30,
    btype: "mine",
    col_title: "الإنتاج/س (والسكان)",
    levels: [
      { lvl: 1, wood: 75, clay: 65, iron: 70, pop: "10 / 10", prod: 30, prop: "30/س" },
      { lvl: 2, wood: 94, clay: 83, iron: 87, pop: "2 / 12", prod: 35, prop: "35/س" },
      { lvl: 3, wood: 118, clay: 106, iron: 108, pop: "2 / 14", prod: 41, prop: "41/س" },
      { lvl: 4, wood: 147, clay: 135, iron: 133, pop: "2 / 16", prod: 47, prop: "47/س" },
      { lvl: 5, wood: 184, clay: 172, iron: 165, pop: "3 / 19", prod: 55, prop: "55/س" },
      { lvl: 6, wood: 231, clay: 219, iron: 205, pop: "3 / 22", prod: 64, prop: "64/س" },
      { lvl: 7, wood: 289, clay: 279, iron: 254, pop: "4 / 26", prod: 74, prop: "74/س" },
      { lvl: 8, wood: 362, clay: 356, iron: 316, pop: "4 / 30", prod: 86, prop: "86/س" },
      { lvl: 9, wood: 453, clay: 454, iron: 391, pop: "5 / 35", prod: 100, prop: "100/س" },
      { lvl: 10, wood: 567, clay: 579, iron: 485, pop: "6 / 41", prod: 117, prop: "117/س" },
      { lvl: 11, wood: 710, clay: 738, iron: 602, pop: "7 / 48", prod: 136, prop: "136/س" },
      { lvl: 12, wood: 889, clay: 941, iron: 746, pop: "8 / 56", prod: 158, prop: "158/س" },
      { lvl: 13, wood: 1113, clay: 1200, iron: 925, pop: "10 / 66", prod: 184, prop: "184/س" },
      { lvl: 14, wood: 1393, clay: 1529, iron: 1147, pop: "11 / 77", prod: 214, prop: "214/س" },
      { lvl: 15, wood: 1744, clay: 1950, iron: 1422, pop: "13 / 90", prod: 249, prop: "249/س" },
      { lvl: 16, wood: 2183, clay: 2486, iron: 1764, pop: "15 / 105", prod: 289, prop: "289/س" },
      { lvl: 17, wood: 2734, clay: 3170, iron: 2187, pop: "18 / 123", prod: 337, prop: "337/س" },
      { lvl: 18, wood: 3422, clay: 4042, iron: 2712, pop: "21 / 144", prod: 391, prop: "391/س" },
      { lvl: 19, wood: 4285, clay: 5153, iron: 3363, pop: "25 / 169", prod: 455, prop: "455/س" },
      { lvl: 20, wood: 5365, clay: 6571, iron: 4170, pop: "28 / 197", prod: 530, prop: "530/س" },
      { lvl: 21, wood: 6717, clay: 8378, iron: 5170, pop: "34 / 231", prod: 616, prop: "616/س" },
      { lvl: 22, wood: 8409, clay: 10681, iron: 6411, pop: "39 / 270", prod: 717, prop: "717/س" },
      { lvl: 23, wood: 10528, clay: 13619, iron: 7950, pop: "46 / 316", prod: 833, prop: "833/س" },
      { lvl: 24, wood: 13181, clay: 17364, iron: 9858, pop: "54 / 370", prod: 969, prop: "969/س" },
      { lvl: 25, wood: 16503, clay: 22139, iron: 12224, pop: "63 / 433", prod: 1127, prop: "1,127/س" },
      { lvl: 26, wood: 20662, clay: 28227, iron: 15158, pop: "74 / 507", prod: 1311, prop: "1,311/س" },
      { lvl: 27, wood: 25869, clay: 35990, iron: 18796, pop: "86 / 593", prod: 1525, prop: "1,525/س" },
      { lvl: 28, wood: 32388, clay: 45887, iron: 23307, pop: "100 / 693", prod: 1774, prop: "1,774/س" },
      { lvl: 29, wood: 40549, clay: 58506, iron: 28900, pop: "118 / 811", prod: 2063, prop: "2,063/س" },
      { lvl: 30, wood: 50768, clay: 74595, iron: 35837, pop: "138 / 949", prod: 2400, prop: "2,400/س" }
    ]
  },
  "المبنى الرئيسي": {
    name: "المبنى الرئيسي",
    max_lvl: 30,
    btype: "hq",
    col_title: "معامل زمن البناء",
    levels: [
      { lvl: 1, wood: 90, clay: 80, iron: 70, pop: "5 / 5", prod: 0, prop: "95%" },
      { lvl: 2, wood: 113, clay: 102, iron: 88, pop: "1 / 6", prod: 0, prop: "91%" },
      { lvl: 3, wood: 143, clay: 130, iron: 111, pop: "1 / 7", prod: 0, prop: "86%" },
      { lvl: 4, wood: 180, clay: 166, iron: 140, pop: "1 / 8", prod: 0, prop: "82%" },
      { lvl: 5, wood: 227, clay: 211, iron: 176, pop: "1 / 9", prod: 0, prop: "78%" },
      { lvl: 6, wood: 286, clay: 270, iron: 222, pop: "2 / 11", prod: 0, prop: "75%" },
      { lvl: 7, wood: 360, clay: 344, iron: 280, pop: "2 / 13", prod: 0, prop: "71%" },
      { lvl: 8, wood: 454, clay: 438, iron: 353, pop: "2 / 15", prod: 0, prop: "68%" },
      { lvl: 9, wood: 572, clay: 559, iron: 445, pop: "3 / 18", prod: 0, prop: "64%" },
      { lvl: 10, wood: 720, clay: 712, iron: 560, pop: "3 / 21", prod: 0, prop: "61%" },
      { lvl: 11, wood: 908, clay: 908, iron: 706, pop: "3 / 24", prod: 0, prop: "58%" },
      { lvl: 12, wood: 1144, clay: 1158, iron: 890, pop: "4 / 28", prod: 0, prop: "56%" },
      { lvl: 13, wood: 1441, clay: 1476, iron: 1121, pop: "5 / 33", prod: 0, prop: "53%" },
      { lvl: 14, wood: 1816, clay: 1882, iron: 1412, pop: "5 / 38", prod: 0, prop: "51%" },
      { lvl: 15, wood: 2288, clay: 2400, iron: 1779, pop: "7 / 45", prod: 0, prop: "48%" },
      { lvl: 16, wood: 2883, clay: 3060, iron: 2242, pop: "8 / 53", prod: 0, prop: "46%" },
      { lvl: 17, wood: 3632, clay: 3902, iron: 2825, pop: "9 / 62", prod: 0, prop: "44%" },
      { lvl: 18, wood: 4577, clay: 4975, iron: 3560, pop: "10 / 72", prod: 0, prop: "42%" },
      { lvl: 19, wood: 5767, clay: 6343, iron: 4485, pop: "12 / 84", prod: 0, prop: "40%" },
      { lvl: 20, wood: 7266, clay: 8087, iron: 5651, pop: "15 / 99", prod: 0, prop: "38%" },
      { lvl: 21, wood: 9155, clay: 10311, iron: 7120, pop: "17 / 116", prod: 0, prop: "36%" },
      { lvl: 22, wood: 11535, clay: 13146, iron: 8972, pop: "19 / 135", prod: 0, prop: "34%" },
      { lvl: 23, wood: 14534, clay: 16762, iron: 11304, pop: "23 / 158", prod: 0, prop: "33%" },
      { lvl: 24, wood: 18313, clay: 21371, iron: 14244, pop: "27 / 185", prod: 0, prop: "31%" },
      { lvl: 25, wood: 23075, clay: 27248, iron: 17947, pop: "31 / 216", prod: 0, prop: "30%" },
      { lvl: 26, wood: 29074, clay: 34741, iron: 22613, pop: "37 / 253", prod: 0, prop: "28%" },
      { lvl: 27, wood: 36633, clay: 44295, iron: 28493, pop: "43 / 296", prod: 0, prop: "27%" },
      { lvl: 28, wood: 46158, clay: 56476, iron: 35901, pop: "51 / 347", prod: 0, prop: "26%" },
      { lvl: 29, wood: 58159, clay: 72007, iron: 45235, pop: "59 / 406", prod: 0, prop: "24%" },
      { lvl: 30, wood: 73280, clay: 91809, iron: 56996, pop: "69 / 475", prod: 0, prop: "23%" }
    ]
  },
  "الثكنات": {
    name: "الثكنات",
    max_lvl: 25,
    btype: "barracks",
    col_title: "معامل التدريب",
    levels: [
      { lvl: 1, wood: 200, clay: 170, iron: 90, pop: "7 / 7", prod: 0, prop: "63%" },
      { lvl: 2, wood: 252, clay: 218, iron: 113, pop: "1 / 8", prod: 0, prop: "59%" },
      { lvl: 3, wood: 318, clay: 279, iron: 143, pop: "2 / 10", prod: 0, prop: "56%" },
      { lvl: 4, wood: 400, clay: 357, iron: 180, pop: "1 / 11", prod: 0, prop: "53%" },
      { lvl: 5, wood: 504, clay: 456, iron: 227, pop: "2 / 13", prod: 0, prop: "50%" },
      { lvl: 6, wood: 635, clay: 584, iron: 286, pop: "2 / 15", prod: 0, prop: "47%" },
      { lvl: 7, wood: 800, clay: 748, iron: 360, pop: "3 / 18", prod: 0, prop: "44%" },
      { lvl: 8, wood: 1008, clay: 957, iron: 454, pop: "3 / 21", prod: 0, prop: "42%" },
      { lvl: 9, wood: 1271, clay: 1225, iron: 572, pop: "4 / 25", prod: 0, prop: "39%" },
      { lvl: 10, wood: 1601, clay: 1568, iron: 720, pop: "4 / 29", prod: 0, prop: "37%" },
      { lvl: 11, wood: 2017, clay: 2007, iron: 908, pop: "5 / 34", prod: 0, prop: "35%" },
      { lvl: 12, wood: 2542, clay: 2569, iron: 1144, pop: "5 / 39", prod: 0, prop: "33%" },
      { lvl: 13, wood: 3202, clay: 3288, iron: 1441, pop: "7 / 46", prod: 0, prop: "31%" },
      { lvl: 14, wood: 4035, clay: 4209, iron: 1816, pop: "8 / 54", prod: 0, prop: "29%" },
      { lvl: 15, wood: 5084, clay: 5388, iron: 2288, pop: "9 / 63", prod: 0, prop: "28%" },
      { lvl: 16, wood: 6406, clay: 6896, iron: 2883, pop: "11 / 74", prod: 0, prop: "26%" },
      { lvl: 17, wood: 8072, clay: 8827, iron: 3632, pop: "12 / 86", prod: 0, prop: "25%" },
      { lvl: 18, wood: 10170, clay: 11298, iron: 4577, pop: "15 / 101", prod: 0, prop: "23%" },
      { lvl: 19, wood: 12814, clay: 14462, iron: 5767, pop: "17 / 118", prod: 0, prop: "22%" },
      { lvl: 20, wood: 16146, clay: 18511, iron: 7266, pop: "20 / 138", prod: 0, prop: "21%" },
      { lvl: 21, wood: 20344, clay: 23695, iron: 9155, pop: "24 / 162", prod: 0, prop: "20%" },
      { lvl: 22, wood: 25634, clay: 30329, iron: 11535, pop: "27 / 189", prod: 0, prop: "19%" },
      { lvl: 23, wood: 32298, clay: 38821, iron: 14534, pop: "32 / 221", prod: 0, prop: "17%" },
      { lvl: 24, wood: 40696, clay: 49691, iron: 18313, pop: "38 / 259", prod: 0, prop: "16%" },
      { lvl: 25, wood: 51277, clay: 63605, iron: 23075, pop: "44 / 303", prod: 0, prop: "16%" }
    ]
  },
  "الإسطبل": {
    name: "الإسطبل",
    max_lvl: 20,
    btype: "stable",
    col_title: "معامل التدريب",
    levels: [
      { lvl: 1, wood: 270, clay: 240, iron: 260, pop: "8 / 8", prod: 0, prop: "63%" },
      { lvl: 2, wood: 340, clay: 307, iron: 328, pop: "1 / 9", prod: 0, prop: "59%" },
      { lvl: 3, wood: 429, clay: 393, iron: 413, pop: "2 / 11", prod: 0, prop: "56%" },
      { lvl: 4, wood: 540, clay: 503, iron: 520, pop: "2 / 13", prod: 0, prop: "53%" },
      { lvl: 5, wood: 681, clay: 644, iron: 655, pop: "2 / 15", prod: 0, prop: "50%" },
      { lvl: 6, wood: 857, clay: 825, iron: 826, pop: "3 / 18", prod: 0, prop: "47%" },
      { lvl: 7, wood: 1080, clay: 1056, iron: 1040, pop: "3 / 21", prod: 0, prop: "44%" },
      { lvl: 8, wood: 1361, clay: 1351, iron: 1311, pop: "3 / 24", prod: 0, prop: "42%" },
      { lvl: 9, wood: 1715, clay: 1729, iron: 1652, pop: "4 / 28", prod: 0, prop: "39%" },
      { lvl: 10, wood: 2161, clay: 2214, iron: 2081, pop: "5 / 33", prod: 0, prop: "37%" },
      { lvl: 11, wood: 2723, clay: 2833, iron: 2622, pop: "5 / 38", prod: 0, prop: "35%" },
      { lvl: 12, wood: 3431, clay: 3627, iron: 3304, pop: "7 / 45", prod: 0, prop: "33%" },
      { lvl: 13, wood: 4323, clay: 4642, iron: 4163, pop: "8 / 53", prod: 0, prop: "31%" },
      { lvl: 14, wood: 5447, clay: 5942, iron: 5246, pop: "9 / 62", prod: 0, prop: "29%" },
      { lvl: 15, wood: 6864, clay: 7606, iron: 6609, pop: "10 / 72", prod: 0, prop: "28%" },
      { lvl: 16, wood: 8648, clay: 9736, iron: 8328, pop: "12 / 84", prod: 0, prop: "26%" },
      { lvl: 17, wood: 10897, clay: 12462, iron: 10493, pop: "15 / 99", prod: 0, prop: "25%" },
      { lvl: 18, wood: 13730, clay: 15951, iron: 13221, pop: "16 / 115", prod: 0, prop: "23%" },
      { lvl: 19, wood: 17300, clay: 20417, iron: 16659, pop: "20 / 135", prod: 0, prop: "22%" },
      { lvl: 20, wood: 21797, clay: 26134, iron: 20990, pop: "23 / 158", prod: 0, prop: "21%" }
    ]
  },
  "الورشة": {
    name: "الورشة",
    max_lvl: 15,
    btype: "workshop",
    col_title: "معامل التصنيع",
    levels: [
      { lvl: 1, wood: 300, clay: 240, iron: 260, pop: "8 / 8", prod: 0, prop: "63%" },
      { lvl: 2, wood: 378, clay: 307, iron: 328, pop: "1 / 9", prod: 0, prop: "59%" },
      { lvl: 3, wood: 476, clay: 393, iron: 413, pop: "2 / 11", prod: 0, prop: "56%" },
      { lvl: 4, wood: 600, clay: 503, iron: 520, pop: "2 / 13", prod: 0, prop: "53%" },
      { lvl: 5, wood: 756, clay: 644, iron: 655, pop: "2 / 15", prod: 0, prop: "50%" },
      { lvl: 6, wood: 953, clay: 825, iron: 826, pop: "3 / 18", prod: 0, prop: "47%" },
      { lvl: 7, wood: 1200, clay: 1056, iron: 1040, pop: "3 / 21", prod: 0, prop: "44%" },
      { lvl: 8, wood: 1513, clay: 1351, iron: 1311, pop: "3 / 24", prod: 0, prop: "42%" },
      { lvl: 9, wood: 1906, clay: 1729, iron: 1652, pop: "4 / 28", prod: 0, prop: "39%" },
      { lvl: 10, wood: 2401, clay: 2214, iron: 2081, pop: "5 / 33", prod: 0, prop: "37%" },
      { lvl: 11, wood: 3026, clay: 2833, iron: 2622, pop: "5 / 38", prod: 0, prop: "35%" },
      { lvl: 12, wood: 3812, clay: 3627, iron: 3304, pop: "7 / 45", prod: 0, prop: "33%" },
      { lvl: 13, wood: 4804, clay: 4642, iron: 4163, pop: "8 / 53", prod: 0, prop: "31%" },
      { lvl: 14, wood: 6053, clay: 5942, iron: 5246, pop: "9 / 62", prod: 0, prop: "29%" },
      { lvl: 15, wood: 7626, clay: 7606, iron: 6609, pop: "10 / 72", prod: 0, prop: "28%" }
    ]
  },
  "الأكاديمية": {
    name: "الأكاديمية",
    max_lvl: 3,
    btype: "academy",
    col_title: "تدريب النبلاء",
    levels: [
      { lvl: 1, wood: 15000, clay: 25000, iron: 10000, pop: "80 / 80", prod: 0, prop: "63%" },
      { lvl: 2, wood: 30000, clay: 50000, iron: 20000, pop: "14 / 94", prod: 0, prop: "59%" },
      { lvl: 3, wood: 60000, clay: 100000, iron: 40000, pop: "16 / 110", prod: 0, prop: "56%" }
    ]
  },
  "الحداد": {
    name: "الحداد",
    max_lvl: 20,
    btype: "smith",
    col_title: "معامل البحث",
    levels: [
      { lvl: 1, wood: 220, clay: 180, iron: 240, pop: "20 / 20", prod: 0, prop: "91%" },
      { lvl: 2, wood: 277, clay: 230, iron: 302, pop: "3 / 23", prod: 0, prop: "83%" },
      { lvl: 3, wood: 349, clay: 293, iron: 381, pop: "4 / 27", prod: 0, prop: "75%" },
      { lvl: 4, wood: 440, clay: 373, iron: 480, pop: "5 / 32", prod: 0, prop: "68%" },
      { lvl: 5, wood: 555, clay: 476, iron: 605, pop: "5 / 37", prod: 0, prop: "62%" },
      { lvl: 6, wood: 699, clay: 606, iron: 762, pop: "7 / 44", prod: 0, prop: "56%" },
      { lvl: 7, wood: 880, clay: 773, iron: 960, pop: "7 / 51", prod: 0, prop: "51%" },
      { lvl: 8, wood: 1109, clay: 986, iron: 1210, pop: "9 / 60", prod: 0, prop: "47%" },
      { lvl: 9, wood: 1398, clay: 1257, iron: 1525, pop: "10 / 70", prod: 0, prop: "42%" },
      { lvl: 10, wood: 1761, clay: 1603, iron: 1921, pop: "12 / 82", prod: 0, prop: "39%" },
      { lvl: 11, wood: 2219, clay: 2043, iron: 2421, pop: "14 / 96", prod: 0, prop: "35%" },
      { lvl: 12, wood: 2796, clay: 2605, iron: 3050, pop: "16 / 112", prod: 0, prop: "32%" },
      { lvl: 13, wood: 3523, clay: 3322, iron: 3843, pop: "20 / 132", prod: 0, prop: "29%" },
      { lvl: 14, wood: 4439, clay: 4236, iron: 4842, pop: "22 / 154", prod: 0, prop: "26%" },
      { lvl: 15, wood: 5593, clay: 5400, iron: 6101, pop: "26 / 180", prod: 0, prop: "24%" },
      { lvl: 16, wood: 7047, clay: 6885, iron: 7687, pop: "31 / 211", prod: 0, prop: "22%" },
      { lvl: 17, wood: 8879, clay: 8779, iron: 9686, pop: "36 / 247", prod: 0, prop: "20%" },
      { lvl: 18, wood: 11187, clay: 11193, iron: 12204, pop: "42 / 289", prod: 0, prop: "18%" },
      { lvl: 19, wood: 14096, clay: 14271, iron: 15377, pop: "49 / 338", prod: 0, prop: "16%" },
      { lvl: 20, wood: 17761, clay: 18196, iron: 19375, pop: "57 / 395", prod: 0, prop: "15%" }
    ]
  },
  "نقطة التجمع": {
    name: "نقطة التجمع",
    max_lvl: 1,
    btype: "place",
    col_title: "إدارة الجيوش",
    levels: [
      { lvl: 1, wood: 10, clay: 40, iron: 30, pop: "0 / 0", prod: 0, prop: "إدارة الجيوش والاغتنام" }
    ]
  },
  "النصب التذكاري": {
    name: "النصب التذكاري",
    max_lvl: 1,
    btype: "statue",
    col_title: "قائد الفرسان",
    levels: [
      { lvl: 1, wood: 220, clay: 220, iron: 220, pop: "10 / 10", prod: 0, prop: "تعيين قائد الفرسان" }
    ]
  },
  "السوق": {
    name: "السوق",
    max_lvl: 25,
    btype: "market",
    col_title: "عدد التجار",
    levels: [
      { lvl: 1, wood: 100, clay: 100, iron: 100, pop: "20 / 20", prod: 0, prop: "1 تاجر" },
      { lvl: 2, wood: 126, clay: 128, iron: 126, pop: "3 / 23", prod: 0, prop: "2 تاجر" },
      { lvl: 3, wood: 159, clay: 163, iron: 159, pop: "4 / 27", prod: 0, prop: "3 تاجر" },
      { lvl: 4, wood: 200, clay: 207, iron: 200, pop: "5 / 32", prod: 0, prop: "4 تاجر" },
      { lvl: 5, wood: 252, clay: 264, iron: 252, pop: "5 / 37", prod: 0, prop: "5 تاجر" },
      { lvl: 6, wood: 318, clay: 337, iron: 318, pop: "7 / 44", prod: 0, prop: "6 تاجر" },
      { lvl: 7, wood: 400, clay: 430, iron: 400, pop: "7 / 51", prod: 0, prop: "7 تاجر" },
      { lvl: 8, wood: 504, clay: 548, iron: 504, pop: "9 / 60", prod: 0, prop: "8 تاجر" },
      { lvl: 9, wood: 635, clay: 698, iron: 635, pop: "10 / 70", prod: 0, prop: "9 تاجر" },
      { lvl: 10, wood: 800, clay: 890, iron: 800, pop: "12 / 82", prod: 0, prop: "10 تاجر" },
      { lvl: 11, wood: 1009, clay: 1135, iron: 1009, pop: "14 / 96", prod: 0, prop: "11 تاجر" },
      { lvl: 12, wood: 1271, clay: 1447, iron: 1271, pop: "16 / 112", prod: 0, prop: "14 تاجر" },
      { lvl: 13, wood: 1601, clay: 1846, iron: 1601, pop: "20 / 132", prod: 0, prop: "19 تاجر" },
      { lvl: 14, wood: 2018, clay: 2353, iron: 2018, pop: "22 / 154", prod: 0, prop: "26 تاجر" },
      { lvl: 15, wood: 2542, clay: 3000, iron: 2542, pop: "26 / 180", prod: 0, prop: "35 تاجر" },
      { lvl: 16, wood: 3203, clay: 3825, iron: 3203, pop: "31 / 211", prod: 0, prop: "46 تاجر" },
      { lvl: 17, wood: 4036, clay: 4877, iron: 4036, pop: "36 / 247", prod: 0, prop: "59 تاجر" },
      { lvl: 18, wood: 5085, clay: 6218, iron: 5085, pop: "42 / 289", prod: 0, prop: "74 تاجر" },
      { lvl: 19, wood: 6407, clay: 7928, iron: 6407, pop: "49 / 338", prod: 0, prop: "91 تاجر" },
      { lvl: 20, wood: 8073, clay: 10109, iron: 8073, pop: "57 / 395", prod: 0, prop: "110 تاجر" },
      { lvl: 21, wood: 10172, clay: 12889, iron: 10172, pop: "67 / 462", prod: 0, prop: "131 تاجر" },
      { lvl: 22, wood: 12817, clay: 16433, iron: 12817, pop: "79 / 541", prod: 0, prop: "154 تاجر" },
      { lvl: 23, wood: 16149, clay: 20952, iron: 16149, pop: "92 / 633", prod: 0, prop: "179 تاجر" },
      { lvl: 24, wood: 20348, clay: 26714, iron: 20348, pop: "107 / 740", prod: 0, prop: "206 تاجر" },
      { lvl: 25, wood: 25639, clay: 34060, iron: 25639, pop: "126 / 866", prod: 0, prop: "235 تاجر" }
    ]
  },
  "المزارع": {
    name: "المزارع",
    max_lvl: 30,
    btype: "farm",
    col_title: "السعة السكانية",
    levels: [
      { lvl: 1, wood: 45, clay: 40, iron: 30, pop: "0 / 0", prod: 0, prop: "240 ساكن" },
      { lvl: 2, wood: 59, clay: 53, iron: 39, pop: "0 / 0", prod: 0, prop: "281 ساكن" },
      { lvl: 3, wood: 76, clay: 70, iron: 50, pop: "0 / 0", prod: 0, prop: "329 ساكن" },
      { lvl: 4, wood: 99, clay: 92, iron: 64, pop: "0 / 0", prod: 0, prop: "386 ساكن" },
      { lvl: 5, wood: 129, clay: 121, iron: 83, pop: "0 / 0", prod: 0, prop: "452 ساكن" },
      { lvl: 6, wood: 167, clay: 160, iron: 107, pop: "0 / 0", prod: 0, prop: "530 ساكن" },
      { lvl: 7, wood: 217, clay: 212, iron: 138, pop: "0 / 0", prod: 0, prop: "622 ساكن" },
      { lvl: 8, wood: 282, clay: 279, iron: 178, pop: "0 / 0", prod: 0, prop: "729 ساكن" },
      { lvl: 9, wood: 367, clay: 369, iron: 230, pop: "0 / 0", prod: 0, prop: "854 ساكن" },
      { lvl: 10, wood: 477, clay: 487, iron: 297, pop: "0 / 0", prod: 0, prop: "1,002 ساكن" },
      { lvl: 11, wood: 620, clay: 642, iron: 383, pop: "0 / 0", prod: 0, prop: "1,174 ساكن" },
      { lvl: 12, wood: 806, clay: 848, iron: 494, pop: "0 / 0", prod: 0, prop: "1,376 ساكن" },
      { lvl: 13, wood: 1048, clay: 1119, iron: 637, pop: "0 / 0", prod: 0, prop: "1,613 ساكن" },
      { lvl: 14, wood: 1363, clay: 1477, iron: 822, pop: "0 / 0", prod: 0, prop: "1,891 ساكن" },
      { lvl: 15, wood: 1772, clay: 1950, iron: 1060, pop: "0 / 0", prod: 0, prop: "2,216 ساكن" },
      { lvl: 16, wood: 2303, clay: 2574, iron: 1368, pop: "0 / 0", prod: 0, prop: "2,598 ساكن" },
      { lvl: 17, wood: 2994, clay: 3398, iron: 1764, pop: "0 / 0", prod: 0, prop: "3,045 ساكن" },
      { lvl: 18, wood: 3893, clay: 4486, iron: 2276, pop: "0 / 0", prod: 0, prop: "3,569 ساكن" },
      { lvl: 19, wood: 5060, clay: 5921, iron: 2936, pop: "0 / 0", prod: 0, prop: "4,183 ساكن" },
      { lvl: 20, wood: 6579, clay: 7816, iron: 3787, pop: "0 / 0", prod: 0, prop: "4,904 ساكن" },
      { lvl: 21, wood: 8552, clay: 10317, iron: 4886, pop: "0 / 0", prod: 0, prop: "5,748 ساكن" },
      { lvl: 22, wood: 11118, clay: 13618, iron: 6302, pop: "0 / 0", prod: 0, prop: "6,737 ساكن" },
      { lvl: 23, wood: 14453, clay: 17976, iron: 8130, pop: "0 / 0", prod: 0, prop: "7,896 ساكن" },
      { lvl: 24, wood: 18789, clay: 23728, iron: 10488, pop: "0 / 0", prod: 0, prop: "9,255 ساكن" },
      { lvl: 25, wood: 24426, clay: 31321, iron: 13529, pop: "0 / 0", prod: 0, prop: "10,848 ساكن" },
      { lvl: 26, wood: 31754, clay: 41344, iron: 17453, pop: "0 / 0", prod: 0, prop: "12,715 ساكن" },
      { lvl: 27, wood: 41280, clay: 54574, iron: 22514, pop: "0 / 0", prod: 0, prop: "14,904 ساكن" },
      { lvl: 28, wood: 53664, clay: 72037, iron: 29043, pop: "0 / 0", prod: 0, prop: "17,469 ساكن" },
      { lvl: 29, wood: 69763, clay: 95089, iron: 37466, pop: "0 / 0", prod: 0, prop: "20,476 ساكن" },
      { lvl: 30, wood: 90692, clay: 125517, iron: 48331, pop: "0 / 0", prod: 0, prop: "24,000 ساكن" }
    ]
  },
  "المخازن": {
    name: "المخازن",
    max_lvl: 30,
    btype: "warehouse",
    col_title: "سعة التخزين",
    levels: [
      { lvl: 1, wood: 60, clay: 50, iron: 40, pop: "0 / 0", prod: 0, prop: "1,000" },
      { lvl: 2, wood: 76, clay: 64, iron: 50, pop: "0 / 0", prod: 0, prop: "1,229" },
      { lvl: 3, wood: 96, clay: 81, iron: 62, pop: "0 / 0", prod: 0, prop: "1,512" },
      { lvl: 4, wood: 121, clay: 102, iron: 77, pop: "0 / 0", prod: 0, prop: "1,859" },
      { lvl: 5, wood: 154, clay: 130, iron: 96, pop: "0 / 0", prod: 0, prop: "2,285" },
      { lvl: 6, wood: 194, clay: 165, iron: 120, pop: "0 / 0", prod: 0, prop: "2,810" },
      { lvl: 7, wood: 246, clay: 210, iron: 149, pop: "0 / 0", prod: 0, prop: "3,454" },
      { lvl: 8, wood: 311, clay: 266, iron: 185, pop: "0 / 0", prod: 0, prop: "4,247" },
      { lvl: 9, wood: 393, clay: 338, iron: 231, pop: "0 / 0", prod: 0, prop: "5,222" },
      { lvl: 10, wood: 498, clay: 430, iron: 287, pop: "0 / 0", prod: 0, prop: "6,420" },
      { lvl: 11, wood: 630, clay: 546, iron: 358, pop: "0 / 0", prod: 0, prop: "7,893" },
      { lvl: 12, wood: 796, clay: 693, iron: 446, pop: "0 / 0", prod: 0, prop: "9,705" },
      { lvl: 13, wood: 1007, clay: 880, iron: 555, pop: "0 / 0", prod: 0, prop: "11,932" },
      { lvl: 14, wood: 1274, clay: 1118, iron: 691, pop: "0 / 0", prod: 0, prop: "14,670" },
      { lvl: 15, wood: 1612, clay: 1420, iron: 860, pop: "0 / 0", prod: 0, prop: "18,037" },
      { lvl: 16, wood: 2039, clay: 1803, iron: 1071, pop: "0 / 0", prod: 0, prop: "22,177" },
      { lvl: 17, wood: 2580, clay: 2290, iron: 1333, pop: "0 / 0", prod: 0, prop: "27,266" },
      { lvl: 18, wood: 3264, clay: 2908, iron: 1659, pop: "0 / 0", prod: 0, prop: "33,523" },
      { lvl: 19, wood: 4128, clay: 3693, iron: 2066, pop: "0 / 0", prod: 0, prop: "41,217" },
      { lvl: 20, wood: 5222, clay: 4691, iron: 2572, pop: "0 / 0", prod: 0, prop: "50,675" },
      { lvl: 21, wood: 6606, clay: 5957, iron: 3202, pop: "0 / 0", prod: 0, prop: "62,305" },
      { lvl: 22, wood: 8357, clay: 7566, iron: 3987, pop: "0 / 0", prod: 0, prop: "76,604" },
      { lvl: 23, wood: 10572, clay: 9608, iron: 4963, pop: "0 / 0", prod: 0, prop: "94,184" },
      { lvl: 24, wood: 13373, clay: 12203, iron: 6180, pop: "0 / 0", prod: 0, prop: "115,798" },
      { lvl: 25, wood: 16917, clay: 15497, iron: 7694, pop: "0 / 0", prod: 0, prop: "142,373" },
      { lvl: 26, wood: 21400, clay: 19682, iron: 9578, pop: "0 / 0", prod: 0, prop: "175,047" },
      { lvl: 27, wood: 27071, clay: 24996, iron: 11925, pop: "0 / 0", prod: 0, prop: "215,219" },
      { lvl: 28, wood: 34245, clay: 31745, iron: 14847, pop: "0 / 0", prod: 0, prop: "264,611" },
      { lvl: 29, wood: 43320, clay: 40316, iron: 18484, pop: "0 / 0", prod: 0, prop: "325,337" },
      { lvl: 30, wood: 54799, clay: 51201, iron: 23013, pop: "0 / 0", prod: 0, prop: "400,000" }
    ]
  },
  "المخابئ": {
    name: "المخابئ",
    max_lvl: 10,
    btype: "hide",
    col_title: "الموارد المخفية",
    levels: [
      { lvl: 1, wood: 50, clay: 60, iron: 50, pop: "2 / 2", prod: 0, prop: "150" },
      { lvl: 2, wood: 63, clay: 75, iron: 63, pop: "0 / 2", prod: 0, prop: "200" },
      { lvl: 3, wood: 78, clay: 94, iron: 78, pop: "1 / 3", prod: 0, prop: "267" },
      { lvl: 4, wood: 98, clay: 117, iron: 98, pop: "0 / 3", prod: 0, prop: "356" },
      { lvl: 5, wood: 122, clay: 146, iron: 122, pop: "1 / 4", prod: 0, prop: "474" },
      { lvl: 6, wood: 153, clay: 183, iron: 153, pop: "0 / 4", prod: 0, prop: "632" },
      { lvl: 7, wood: 191, clay: 229, iron: 191, pop: "1 / 5", prod: 0, prop: "843" },
      { lvl: 8, wood: 238, clay: 286, iron: 238, pop: "1 / 6", prod: 0, prop: "1,125" },
      { lvl: 9, wood: 298, clay: 358, iron: 298, pop: "1 / 7", prod: 0, prop: "1,500" },
      { lvl: 10, wood: 373, clay: 447, iron: 373, pop: "1 / 8", prod: 0, prop: "2,000" }
    ]
  },
  "الحائط": {
    name: "الحائط",
    max_lvl: 20,
    btype: "wall",
    col_title: "دفاع الجيوش",
    levels: [
      { lvl: 1, wood: 50, clay: 100, iron: 20, pop: "5 / 5", prod: 0, prop: "+4%" },
      { lvl: 2, wood: 63, clay: 128, iron: 25, pop: "1 / 6", prod: 0, prop: "+8%" },
      { lvl: 3, wood: 79, clay: 163, iron: 32, pop: "1 / 7", prod: 0, prop: "+12%" },
      { lvl: 4, wood: 100, clay: 207, iron: 40, pop: "1 / 8", prod: 0, prop: "+16%" },
      { lvl: 5, wood: 126, clay: 264, iron: 50, pop: "1 / 9", prod: 0, prop: "+20%" },
      { lvl: 6, wood: 159, clay: 337, iron: 64, pop: "2 / 11", prod: 0, prop: "+24%" },
      { lvl: 7, wood: 200, clay: 430, iron: 80, pop: "2 / 13", prod: 0, prop: "+29%" },
      { lvl: 8, wood: 252, clay: 548, iron: 101, pop: "2 / 15", prod: 0, prop: "+34%" },
      { lvl: 9, wood: 318, clay: 698, iron: 127, pop: "3 / 18", prod: 0, prop: "+39%" },
      { lvl: 10, wood: 400, clay: 890, iron: 160, pop: "3 / 21", prod: 0, prop: "+44%" },
      { lvl: 11, wood: 504, clay: 1135, iron: 202, pop: "3 / 24", prod: 0, prop: "+49%" },
      { lvl: 12, wood: 635, clay: 1447, iron: 254, pop: "4 / 28", prod: 0, prop: "+55%" },
      { lvl: 13, wood: 801, clay: 1846, iron: 320, pop: "5 / 33", prod: 0, prop: "+60%" },
      { lvl: 14, wood: 1009, clay: 2353, iron: 404, pop: "5 / 38", prod: 0, prop: "+66%" },
      { lvl: 15, wood: 1271, clay: 3000, iron: 508, pop: "7 / 45", prod: 0, prop: "+72%" },
      { lvl: 16, wood: 1602, clay: 3825, iron: 641, pop: "8 / 53", prod: 0, prop: "+79%" },
      { lvl: 17, wood: 2018, clay: 4877, iron: 807, pop: "9 / 62", prod: 0, prop: "+85%" },
      { lvl: 18, wood: 2543, clay: 6218, iron: 1017, pop: "10 / 72", prod: 0, prop: "+92%" },
      { lvl: 19, wood: 3204, clay: 7928, iron: 1281, pop: "12 / 84", prod: 0, prop: "99%" },
      { lvl: 20, wood: 4037, clay: 10109, iron: 1615, pop: "15 / 99", prod: 0, prop: "+107%" }
    ]
  }
};

export const WAREHOUSE_CAPACITIES = [
  0, 1000, 1229, 1512, 1859, 2285, 2810, 3454, 4247, 5222, 6420,
  7893, 9705, 11932, 14670, 18037, 22177, 27266, 33523, 41217, 50675,
  62305, 76604, 94184, 115798, 142373, 175047, 215219, 264611, 325337, 400000
] as const;

export const FARM_CAPACITIES = [
  0, 240, 281, 329, 386, 452, 530, 622, 729, 854, 1002,
  1174, 1376, 1613, 1891, 2216, 2598, 3045, 3569, 4183, 4904,
  5748, 6737, 7896, 9255, 10848, 12715, 14904, 17469, 20476, 24000
] as const;

export const MARKET_MERCHANTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 19, 26, 35, 46, 59, 74, 91, 110, 131, 154, 179, 206, 235
] as const;

export const MINE_BASE_PROD = [
  5, 30, 35, 41, 47, 55, 64, 74, 86, 100, 117,
  136, 158, 184, 214, 249, 289, 337, 391, 455, 530,
  616, 717, 833, 969, 1127, 1311, 1525, 1774, 2063, 2400
] as const;

export const BASE_BUILD_TIME: Record<string, [number, number]> = {
  'المبنى الرئيسي': [900, 10],
  'الثكنات': [1800, 10],
  'الإسطبل': [6000, 10],
  'الورشة': [6000, 10],
  'الأكاديمية': [64800, 10],
  'الحداد': [6000, 10],
  'نقطة التجمع': [1080, 10],
  'النصب التذكاري': [1500, 10],
  'السوق': [2700, 10],
  'الخشاب': [900, 10],
  'حفرة الطمي': [900, 10],
  'منجم الحديد': [1080, 10],
  'المزارع': [1200, 10],
  'المخازن': [1020, 10],
  'المخابئ': [1800, 10],
  'الحائط': [3600, 240]
};

export const LEVEL_TIME_FACTORS = [
  0.007552, 0.007554, 0.161452, 0.500304, 0.956705, 1.50814, 2.158727, 2.923994, 3.826395, 4.89346,
  6.158127, 7.6594, 9.443313, 11.565152, 14.088409, 17.089235, 20.657818, 24.900529, 29.944887, 35.938469,
  43.057794, 51.514313, 61.552976, 73.471276, 87.607613, 104.384149, 124.274164, 147.857654, 175.814335, 208.947195
] as const;

export const SCAV_UNLOCK_DATA: Record<string, { name: string; wood: number; clay: number; iron: number; sec: number; lf: number }> = {
  '1': { name: 'فتح الإغارة 1 (10%)', wood: 25, clay: 30, iron: 25, sec: 30, lf: 0.10 },
  '2': { name: 'فتح الإغارة 2 (25%)', wood: 250, clay: 300, iron: 250, sec: 3600, lf: 0.25 },
  '3': { name: 'فتح الإغارة 3 (50%)', wood: 1000, clay: 1200, iron: 1000, sec: 10800, lf: 0.50 },
  '4': { name: 'فتح الإغارة 4 (75%)', wood: 10000, clay: 12000, iron: 10000, sec: 21600, lf: 0.75 }
};

export const FIXED_CONTINENTS = ['44', '45', '54', '55'] as const;

export const SCAV_UNIT_DEFS: ReadonlyArray<{ key: UnitKey; ar: string; haul: number; pop: number }> = [
  { key: 'spear', ar: 'رمح', haul: 25, pop: 1 },
  { key: 'sword', ar: 'سيف', haul: 15, pop: 1 },
  { key: 'axe', ar: 'فأس', haul: 10, pop: 1 },
  { key: 'archer', ar: 'قوس', haul: 10, pop: 1 },
  { key: 'spy', ar: 'كشافة', haul: 0, pop: 2 },
  { key: 'light', ar: 'خفيف', haul: 80, pop: 4 },
  { key: 'marcher', ar: 'قوس خيل', haul: 50, pop: 5 },
  { key: 'heavy', ar: 'ثقيل', haul: 50, pop: 6 },
  { key: 'ram', ar: 'محطمة', haul: 0, pop: 5 },
  { key: 'catapult', ar: 'منجنيق', haul: 0, pop: 8 },
  { key: 'knight', ar: 'قائد', haul: 100, pop: 10 },
  { key: 'snob', ar: 'نبيل', haul: 0, pop: 100 }
];

export const UNIT_CARRY_CAP: Record<UnitKey, number> = {
  spear: 25,
  sword: 15,
  axe: 10,
  archer: 10,
  spy: 0,
  light: 80,
  marcher: 50,
  heavy: 50,
  ram: 0,
  catapult: 0,
  knight: 100,
  snob: 0
};

export const UNIT_POP_COST: Record<UnitKey, number> = {
  spear: 1,
  sword: 1,
  axe: 1,
  archer: 1,
  spy: 2,
  light: 4,
  marcher: 5,
  heavy: 6,
  ram: 5,
  catapult: 8,
  knight: 10,
  snob: 100
};

export const BUILDING_POINTS_TABLE: Record<string, number[]> = {
  'المبنى الرئيسي': [10, 12, 14, 17, 21, 25, 30, 36, 43, 52, 62, 75, 90, 108, 130, 155, 186, 224, 269, 322, 387, 464, 557, 668, 802, 963, 1155, 1386, 1664, 1996],
  'الثكنات': [16, 19, 23, 28, 33, 40, 48, 57, 69, 83, 99, 119, 143, 172, 206, 247, 297, 356, 427, 513, 615, 738, 886, 1063, 1276],
  'الإسطبل': [20, 24, 29, 35, 41, 50, 60, 72, 86, 103, 124, 149, 178, 214, 257, 308, 370, 444, 532, 639],
  'الورشة': [24, 29, 35, 41, 50, 60, 72, 86, 104, 124, 149, 179, 215, 258, 310],
  'الأكاديمية': [512, 614, 737],
  'الحداد': [19, 23, 27, 33, 39, 47, 57, 68, 82, 98, 118, 141, 170, 204, 244, 293, 352, 422, 507, 608],
  'نقطة التجمع': [0],
  'النصب التذكاري': [24],
  'السوق': [10, 12, 14, 17, 21, 25, 30, 36, 43, 52, 62, 75, 90, 108, 130, 155, 186, 224, 269, 322, 387, 464, 557, 668, 802],
  'الخشاب': [6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 45, 53, 64, 77, 92, 111, 133, 160, 192, 230, 276, 332, 398, 478, 573, 688, 825, 990, 1188],
  'حفرة الطمي': [6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 45, 53, 64, 77, 92, 111, 133, 160, 192, 230, 276, 332, 398, 478, 573, 688, 825, 990, 1188],
  'منجم الحديد': [6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 45, 53, 64, 77, 92, 111, 133, 160, 192, 230, 276, 332, 398, 478, 573, 688, 825, 990, 1188],
  'المزارع': [5, 6, 7, 9, 11, 13, 15, 18, 22, 26, 32, 38, 45, 55, 65, 79, 94, 113, 136, 163, 195, 234, 281, 337, 405, 486, 583, 700, 840, 1008],
  'المخازن': [6, 7, 9, 10, 12, 15, 18, 21, 26, 31, 37, 45, 53, 64, 77, 92, 111, 133, 160, 192, 230, 276, 332, 398, 478, 573, 688, 825, 990, 1188],
  'المخابئ': [5, 6, 7, 9, 11, 13, 15, 18, 22, 26],
  'الحائط': [8, 10, 12, 14, 17, 20, 24, 29, 34, 41, 50, 59, 71, 86, 103, 123, 148, 177, 213, 256]
};

export const SHORT_CLOUD_BOOKMARKLET =
  "javascript:void(window.__twSyncVersion==='6.0'&&window.__twRunErpSync?__twRunErpSync():fetch('https://firestore.googleapis.com/v1/projects/linear-freedom-9gxqk/databases/ai-studio-erp-58272684-00ec-4692-acb8-6a7218e50c08/documents/incomingVillageSyncs/tw_lib').then(r=>r.json()).then(d=>(0,eval)(d.fields.payloadJson.stringValue)))";
