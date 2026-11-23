// 离线音频清单（自动生成，不要手改）
//
// 生成：node tools/dump-items.js ja /tmp/ja_items.json
//       python3 tools/gen-audio.py --lang ja --items /tmp/ja_items.json --out audio-src/ja
//       node tools/gen-local-audio.js
//
// 为什么不走在线合成：日语整句找不到可靠的免费源——有道 dictvoice 只对单词有效
// （且必须带 le=jap），百度 lan=jap 返回 403，同声传译 textToSpeech 只列中英文。
// 英语虽然有在线源，但学英语最常练，预生成音频能保证首句秒开、不被网络抖动影响。
//
// mp3 不进代码包（真机读不到包内文件），只放仓库 audio-src/，由 CI 铺到 Cloudflare Pages；
// 这里只维护「哪个 id 有音频、CDN 地址是什么」，见 remoteFor()。

const REGION = {
  ja: {
    remote: 'https://yb.qy663.de5.net/audio/',
    count: 353,
    bytes: 1912840,
    ids: 'ja_001 ja_001_ex ja_002 ja_002_ex ja_003 ja_003_ex ja_004 ja_004_ex ja_005 ja_005_ex ja_006 ' +
      'ja_006_ex ja_007 ja_007_ex ja_008 ja_008_ex ja_009 ja_009_ex ja_010 ja_010_ex ja_011 ja_011_ex ' +
      'ja_012 ja_012_ex ja_013 ja_013_ex ja_014 ja_014_ex ja_015 ja_015_ex ja_016 ja_016_ex ja_017 ' +
      'ja_017_ex ja_018 ja_018_ex ja_019 ja_019_ex ja_020 ja_020_ex ja_021 ja_021_ex ja_022 ja_022_ex ' +
      'ja_023 ja_023_ex ja_024 ja_024_ex ja_025 ja_025_ex ja_026 ja_026_ex ja_027 ja_027_ex ja_028 ' +
      'ja_028_ex ja_029 ja_029_ex ja_030 ja_030_ex ja_031 ja_031_ex ja_032 ja_032_ex ja_033 ja_033_ex ' +
      'ja_034 ja_034_ex ja_035 ja_035_ex ja_036 ja_036_ex ja_037 ja_037_ex ja_038 ja_038_ex ja_039 ' +
      'ja_039_ex ja_040 ja_040_ex ja_041 ja_041_ex ja_042 ja_042_ex ja_043 ja_043_ex ja_044 ja_044_ex ' +
      'ja_045 ja_045_ex ja_046 ja_046_ex ja_047 ja_047_ex ja_048 ja_048_ex ja_049 ja_049_ex ja_050 ' +
      'ja_050_ex ja_051 ja_051_ex ja_052 ja_052_ex ja_053 ja_053_ex ja_054 ja_054_ex ja_055 ja_055_ex ' +
      'ja_056 ja_056_ex ja_057 ja_057_ex ja_058 ja_058_ex ja_059 ja_059_ex ja_060 ja_060_ex ja_061 ' +
      'ja_061_ex ja_062 ja_062_ex ja_063 ja_063_ex ja_064 ja_064_ex ja_065 ja_065_ex ja_066 ja_066_ex ' +
      'ja_067 ja_067_ex ja_068 ja_068_ex ja_069 ja_069_ex ja_070 ja_070_ex ja_071 ja_071_ex ja_072 ' +
      'ja_072_ex ja_073 ja_073_ex ja_074 ja_074_ex ja_075 ja_075_ex ja_076 ja_076_ex ja_077 ja_077_ex ' +
      'ja_078 ja_078_ex ja_079 ja_079_ex ja_080 ja_080_ex ja_081 ja_081_ex ja_082 ja_082_ex ja_083 ' +
      'ja_083_ex ja_084 ja_084_ex ja_085 ja_085_ex ja_086 ja_086_ex ja_087 ja_087_ex ja_088 ja_088_ex ' +
      'ja_089 ja_089_ex ja_090 ja_090_ex ja_091 ja_091_ex ja_092 ja_092_ex ja_093 ja_093_ex ja_094 ' +
      'ja_094_ex ja_095 ja_095_ex ja_096 ja_096_ex ja_097 ja_097_ex ja_098 ja_098_ex ja_099 ja_099_ex ' +
      'ja_100 ja_100_ex ja_101 ja_101_ex ja_102 ja_102_ex ja_103 ja_103_ex ja_104 ja_104_ex ja_105 ' +
      'ja_105_ex ja_106 ja_106_ex ja_107 ja_107_ex ja_108 ja_108_ex ja_109 ja_109_ex ja_110 ja_110_ex ' +
      'jd001_1 jd001_2 jd001_3 jd001_4 jd002_1 jd002_2 jd002_3 jd002_4 jd003_1 jd003_2 jd003_3 jd004_1 ' +
      'jd004_2 jd004_3 jd004_4 jd005_1 jd005_2 jd005_3 jd005_4 jd006_1 jd006_2 jd006_3 jd006_4 jd007_1 ' +
      'jd007_2 jd007_3 jd007_4 jd007_5 jd008_1 jd008_2 jd008_3 jd008_4 jd008_5 js001 js002 js003 js004 ' +
      'js005 js006 js007 js008 js009 js010 js011 js012 js013 js014 js015 js016 js017 js018 js019 js020 ' +
      'js021 js022 js023 js024 js025 js026 js027 js028 js029 js030 js031 js032 js033 js034 js035 js036 ' +
      'js037 js038 js039 js040 js041 js042 js043 js044 js045 js046 js047 js048 js049 js050 js051 js052 ' +
      'js053 js054 js055 js056 js057 js058 js059 js060 js061 js062 js063 js064 js065 js066 js067 js068 ' +
      'js069 js070 js071 js072 js073 js074 js075 js076 js077 js078 js079 js080 js081 js082 js083 js084 ' +
      'js085 js086 js087 js088 js089 js090 js091 js092 js093 js094 js095 js096 js097 js098 js099 js100'
  },
  en: {
    remote: 'https://yb.qy663.de5.net/audio-en/',
    count: 1748,
    bytes: 8158336,
    ids: 'd001_1 d001_2 d001_3 d001_4 d002_1 d002_2 d002_3 d003_1 d003_2 d003_3 d004_1 d004_2 d004_3 d005_1 ' +
      'd005_2 d005_3 d006_1 d006_2 d006_3 d006_4 d007_1 d007_2 d007_3 d007_4 d008_1 d008_2 d008_3 d008_4 ' +
      'en_001 en_001_ex en_002 en_002_ex en_003 en_003_ex en_004 en_004_ex en_005 en_005_ex en_006 ' +
      'en_006_ex en_007 en_007_ex en_008 en_008_ex en_009 en_009_ex en_010 en_010_ex en_011 en_011_ex ' +
      'en_012 en_012_ex en_013 en_013_ex en_014 en_014_ex en_015 en_015_ex en_016 en_016_ex en_017 ' +
      'en_017_ex en_018 en_018_ex en_019 en_019_ex en_020 en_020_ex en_021 en_021_ex en_022 en_022_ex ' +
      'en_023 en_023_ex en_024 en_024_ex en_025 en_025_ex en_026 en_026_ex en_027 en_027_ex en_028 ' +
      'en_028_ex en_029 en_029_ex en_030 en_030_ex en_031 en_031_ex en_032 en_032_ex en_033 en_033_ex ' +
      'en_034 en_034_ex en_035 en_035_ex en_036 en_036_ex en_037 en_037_ex en_038 en_038_ex en_039 ' +
      'en_039_ex en_040 en_040_ex en_041 en_041_ex en_042 en_042_ex en_043 en_043_ex en_044 en_044_ex ' +
      'en_045 en_045_ex en_046 en_046_ex en_047 en_047_ex en_048 en_048_ex en_049 en_049_ex en_050 ' +
      'en_050_ex en_051 en_051_ex en_052 en_052_ex en_053 en_053_ex en_054 en_054_ex en_055 en_055_ex ' +
      'en_056 en_056_ex en_057 en_057_ex en_058 en_058_ex en_059 en_059_ex en_060 en_060_ex en_061 ' +
      'en_061_ex en_062 en_062_ex en_063 en_063_ex en_064 en_064_ex en_065 en_065_ex en_066 en_066_ex ' +
      'en_067 en_067_ex en_068 en_068_ex en_069 en_069_ex en_070 en_070_ex en_071 en_071_ex en_072 ' +
      'en_072_ex en_073 en_073_ex en_074 en_074_ex en_075 en_075_ex en_076 en_076_ex en_077 en_077_ex ' +
      'en_078 en_078_ex en_079 en_079_ex en_080 en_080_ex en_081 en_081_ex en_082 en_082_ex en_083 ' +
      'en_083_ex en_084 en_084_ex en_085 en_085_ex en_086 en_086_ex en_087 en_087_ex en_088 en_088_ex ' +
      'en_089 en_089_ex en_090 en_090_ex en_091 en_091_ex en_092 en_092_ex en_093 en_093_ex en_094 ' +
      'en_094_ex en_095 en_095_ex en_096 en_096_ex en_097 en_097_ex en_098 en_098_ex en_099 en_099_ex ' +
      'en_100 en_100_ex en_101 en_101_ex en_102 en_102_ex en_103 en_103_ex en_104 en_104_ex en_105 ' +
      'en_105_ex en_106 en_106_ex en_107 en_107_ex en_108 en_108_ex en_109 en_109_ex en_110 en_110_ex ' +
      'en_111 en_111_ex en_112 en_112_ex en_113 en_113_ex en_114 en_114_ex en_115 en_115_ex en_116 ' +
      'en_116_ex en_117 en_117_ex en_118 en_118_ex en_119 en_119_ex en_120 en_120_ex en_121 en_121_ex ' +
      'en_122 en_122_ex en_123 en_123_ex en_124 en_124_ex en_125 en_125_ex en_126 en_126_ex en_127 ' +
      'en_127_ex en_128 en_128_ex en_129 en_129_ex en_130 en_130_ex en_131 en_131_ex en_132 en_132_ex ' +
      'en_133 en_133_ex en_134 en_134_ex en_135 en_135_ex en_136 en_136_ex en_137 en_137_ex en_138 ' +
      'en_138_ex en_139 en_139_ex en_140 en_140_ex en_141 en_141_ex en_142 en_142_ex en_143 en_143_ex ' +
      'en_144 en_144_ex en_145 en_145_ex en_146 en_146_ex en_147 en_147_ex en_148 en_148_ex en_149 ' +
      'en_149_ex en_150 en_150_ex en_151 en_151_ex en_152 en_152_ex en_153 en_153_ex en_154 en_154_ex ' +
      'en_155 en_155_ex en_156 en_156_ex en_157 en_157_ex en_158 en_158_ex en_159 en_159_ex en_160 ' +
      'en_160_ex en_161 en_161_ex en_162 en_162_ex en_163 en_163_ex en_164 en_164_ex en_165 en_165_ex ' +
      'en_166 en_166_ex en_167 en_167_ex en_168 en_168_ex en_169 en_169_ex en_170 en_170_ex en_171 ' +
      'en_171_ex en_172 en_172_ex en_173 en_173_ex en_174 en_174_ex en_175 en_175_ex en_176 en_176_ex ' +
      'en_177 en_177_ex en_178 en_178_ex en_179 en_179_ex en_180 en_180_ex en_181 en_181_ex en_182 ' +
      'en_182_ex en_183 en_183_ex en_184 en_184_ex en_185 en_185_ex en_186 en_186_ex en_187 en_187_ex ' +
      'en_188 en_188_ex en_189 en_189_ex en_190 en_190_ex en_191 en_191_ex en_192 en_192_ex en_193 ' +
      'en_193_ex en_194 en_194_ex en_195 en_195_ex en_196 en_196_ex en_197 en_197_ex en_198 en_198_ex ' +
      'en_199 en_199_ex en_200 en_200_ex en_201 en_201_ex en_202 en_202_ex en_203 en_203_ex en_204 ' +
      'en_204_ex en_205 en_205_ex en_206 en_206_ex en_207 en_207_ex en_208 en_208_ex en_209 en_209_ex ' +
      'en_210 en_210_ex en_211 en_211_ex en_212 en_212_ex en_213 en_213_ex en_214 en_214_ex en_215 ' +
      'en_215_ex en_216 en_216_ex en_217 en_217_ex en_218 en_218_ex en_219 en_219_ex en_220 en_220_ex ' +
      'en_221 en_221_ex en_222 en_222_ex en_223 en_223_ex en_224 en_224_ex en_225 en_225_ex en_226 ' +
      'en_226_ex en_227 en_227_ex en_228 en_228_ex en_229 en_229_ex en_230 en_230_ex en_231 en_231_ex ' +
      'en_232 en_232_ex en_233 en_233_ex en_234 en_234_ex en_235 en_235_ex en_236 en_236_ex en_237 ' +
      'en_237_ex en_238 en_238_ex en_239 en_239_ex en_240 en_240_ex en_241 en_241_ex en_242 en_242_ex ' +
      'en_243 en_243_ex en_244 en_244_ex en_245 en_245_ex en_246 en_246_ex en_247 en_247_ex en_248 ' +
      'en_248_ex en_249 en_249_ex en_250 en_250_ex en_251 en_251_ex en_252 en_252_ex en_253 en_253_ex ' +
      'en_254 en_254_ex en_255 en_255_ex en_256 en_256_ex en_257 en_257_ex en_258 en_258_ex en_259 ' +
      'en_259_ex en_260 en_260_ex en_261 en_261_ex en_262 en_262_ex en_263 en_263_ex en_264 en_264_ex ' +
      'en_265 en_265_ex en_266 en_266_ex en_267 en_267_ex en_268 en_268_ex en_269 en_269_ex en_270 ' +
      'en_270_ex en_271 en_271_ex en_272 en_272_ex en_273 en_273_ex en_274 en_274_ex en_275 en_275_ex ' +
      'en_276 en_276_ex en_277 en_277_ex en_278 en_278_ex en_279 en_279_ex en_280 en_280_ex en_281 ' +
      'en_281_ex en_282 en_282_ex en_283 en_283_ex en_284 en_284_ex en_285 en_285_ex en_286 en_286_ex ' +
      'en_287 en_287_ex en_288 en_288_ex en_289 en_289_ex en_290 en_290_ex en_291 en_291_ex en_292 ' +
      'en_292_ex en_293 en_293_ex en_294 en_294_ex en_295 en_295_ex en_296 en_296_ex en_297 en_297_ex ' +
      'en_298 en_298_ex en_299 en_299_ex en_300 en_300_ex en_301 en_301_ex en_302 en_302_ex en_303 ' +
      'en_303_ex en_304 en_304_ex en_305 en_305_ex en_306 en_306_ex en_307 en_307_ex en_308 en_308_ex ' +
      'en_309 en_309_ex en_310 en_310_ex en_311 en_311_ex en_312 en_312_ex en_313 en_313_ex en_314 ' +
      'en_314_ex en_315 en_315_ex en_316 en_316_ex en_317 en_317_ex en_318 en_318_ex en_319 en_319_ex ' +
      'en_320 en_320_ex en_321 en_321_ex en_322 en_322_ex en_323 en_323_ex en_324 en_324_ex en_325 ' +
      'en_325_ex en_326 en_326_ex en_327 en_327_ex en_328 en_328_ex en_329 en_329_ex en_330 en_330_ex ' +
      'en_331 en_331_ex en_332 en_332_ex en_333 en_333_ex en_334 en_334_ex en_335 en_335_ex en_336 ' +
      'en_336_ex en_337 en_337_ex en_338 en_338_ex en_339 en_339_ex en_340 en_340_ex en_341 en_341_ex ' +
      'en_342 en_342_ex en_343 en_343_ex en_344 en_344_ex en_345 en_345_ex en_346 en_346_ex en_347 ' +
      'en_347_ex en_348 en_348_ex en_349 en_349_ex en_350 en_350_ex en_351 en_351_ex en_352 en_352_ex ' +
      'en_353 en_353_ex en_354 en_354_ex en_355 en_355_ex en_356 en_356_ex en_357 en_357_ex en_358 ' +
      'en_358_ex en_359 en_359_ex en_360 en_360_ex en_361 en_361_ex en_362 en_362_ex en_363 en_363_ex ' +
      'en_364 en_364_ex en_365 en_365_ex en_366 en_366_ex en_367 en_367_ex en_368 en_368_ex en_369 ' +
      'en_369_ex en_370 en_370_ex en_371 en_371_ex en_372 en_372_ex en_373 en_373_ex en_374 en_374_ex ' +
      'en_375 en_375_ex en_376 en_376_ex en_377 en_377_ex en_378 en_378_ex en_379 en_379_ex en_380 ' +
      'en_380_ex en_381 en_381_ex en_382 en_382_ex en_383 en_383_ex en_384 en_384_ex en_385 en_385_ex ' +
      'en_386 en_386_ex en_387 en_387_ex en_388 en_388_ex en_389 en_389_ex en_390 en_390_ex en_391 ' +
      'en_391_ex en_392 en_392_ex en_393 en_393_ex en_394 en_394_ex en_395 en_395_ex en_396 en_396_ex ' +
      'en_397 en_397_ex en_398 en_398_ex en_399 en_399_ex en_400 en_400_ex en_401 en_401_ex en_402 ' +
      'en_402_ex en_403 en_403_ex en_404 en_404_ex en_405 en_405_ex en_406 en_406_ex en_407 en_407_ex ' +
      'en_408 en_408_ex en_409 en_409_ex en_410 en_410_ex en_411 en_411_ex en_412 en_412_ex en_413 ' +
      'en_413_ex en_414 en_414_ex en_415 en_415_ex en_416 en_416_ex en_417 en_417_ex en_418 en_418_ex ' +
      'en_419 en_419_ex en_420 en_420_ex en_421 en_421_ex en_422 en_422_ex en_423 en_423_ex en_424 ' +
      'en_424_ex en_425 en_425_ex en_426 en_426_ex en_427 en_427_ex en_428 en_428_ex en_429 en_429_ex ' +
      'en_430 en_430_ex en_431 en_431_ex en_432 en_432_ex en_433 en_433_ex en_434 en_434_ex en_435 ' +
      'en_435_ex en_436 en_436_ex en_437 en_437_ex en_438 en_438_ex en_439 en_439_ex en_440 en_440_ex ' +
      'en_441 en_441_ex en_442 en_442_ex en_443 en_443_ex en_444 en_444_ex en_445 en_445_ex en_446 ' +
      'en_446_ex en_447 en_447_ex en_448 en_448_ex en_449 en_449_ex en_450 en_450_ex en_451 en_451_ex ' +
      'en_452 en_452_ex en_453 en_453_ex en_454 en_454_ex en_455 en_455_ex en_456 en_456_ex en_457 ' +
      'en_457_ex en_458 en_458_ex en_459 en_459_ex en_460 en_460_ex en_461 en_461_ex en_462 en_462_ex ' +
      'en_463 en_463_ex en_464 en_464_ex en_465 en_465_ex en_466 en_466_ex en_467 en_467_ex en_468 ' +
      'en_468_ex en_469 en_469_ex en_470 en_470_ex en_471 en_471_ex en_472 en_472_ex en_473 en_473_ex ' +
      'en_474 en_474_ex en_475 en_475_ex en_476 en_476_ex en_477 en_477_ex en_478 en_478_ex en_479 ' +
      'en_479_ex en_480 en_480_ex en_481 en_481_ex en_482 en_482_ex en_483 en_483_ex en_484 en_484_ex ' +
      'en_485 en_485_ex en_486 en_486_ex en_487 en_487_ex en_488 en_488_ex en_489 en_489_ex en_490 ' +
      'en_490_ex en_491 en_491_ex en_492 en_492_ex en_493 en_493_ex en_494 en_494_ex en_495 en_495_ex ' +
      'en_496 en_496_ex en_497 en_497_ex en_498 en_498_ex en_499 en_499_ex en_500 en_500_ex en_501 ' +
      'en_501_ex en_502 en_502_ex en_503 en_503_ex en_504 en_504_ex en_505 en_505_ex en_506 en_506_ex ' +
      'en_507 en_507_ex en_508 en_508_ex en_509 en_509_ex en_510 en_510_ex en_511 en_511_ex en_512 ' +
      'en_512_ex en_513 en_513_ex en_514 en_514_ex en_515 en_515_ex en_516 en_516_ex en_517 en_517_ex ' +
      'en_518 en_518_ex en_519 en_519_ex en_520 en_520_ex en_521 en_521_ex en_522 en_522_ex en_523 ' +
      'en_523_ex en_524 en_524_ex en_525 en_525_ex en_526 en_526_ex en_527 en_527_ex en_528 en_528_ex ' +
      'en_529 en_529_ex en_530 en_530_ex en_531 en_531_ex en_532 en_532_ex en_533 en_533_ex en_534 ' +
      'en_534_ex en_535 en_535_ex en_536 en_536_ex en_537 en_537_ex en_538 en_538_ex en_539 en_539_ex ' +
      'en_540 en_540_ex en_541 en_541_ex en_542 en_542_ex en_543 en_543_ex en_544 en_544_ex en_545 ' +
      'en_545_ex en_546 en_546_ex en_547 en_547_ex en_548 en_548_ex en_549 en_549_ex en_550 en_550_ex ' +
      'en_551 en_551_ex en_552 en_552_ex en_553 en_553_ex en_554 en_554_ex en_555 en_555_ex en_556 ' +
      'en_556_ex en_557 en_557_ex en_558 en_558_ex en_559 en_559_ex en_560 en_560_ex en_561 en_561_ex ' +
      'en_562 en_562_ex en_563 en_563_ex en_564 en_564_ex en_565 en_565_ex en_566 en_566_ex en_567 ' +
      'en_567_ex en_568 en_568_ex en_569 en_569_ex en_570 en_570_ex en_571 en_571_ex en_572 en_572_ex ' +
      'en_573 en_573_ex en_574 en_574_ex en_575 en_575_ex en_576 en_576_ex en_577 en_577_ex en_578 ' +
      'en_578_ex en_579 en_579_ex en_580 en_580_ex en_581 en_581_ex en_582 en_582_ex en_583 en_583_ex ' +
      'en_584 en_584_ex en_585 en_585_ex en_586 en_586_ex en_587 en_587_ex en_588 en_588_ex en_589 ' +
      'en_589_ex en_590 en_590_ex en_591 en_591_ex en_592 en_592_ex en_593 en_593_ex en_594 en_594_ex ' +
      'en_595 en_595_ex en_596 en_596_ex en_597 en_597_ex en_598 en_598_ex en_599 en_599_ex en_600 ' +
      'en_600_ex en_601 en_601_ex en_602 en_602_ex en_603 en_603_ex en_604 en_604_ex en_605 en_605_ex ' +
      'en_606 en_606_ex en_607 en_607_ex en_608 en_608_ex en_609 en_609_ex en_610 en_610_ex en_611 ' +
      'en_611_ex en_612 en_612_ex en_613 en_613_ex en_614 en_614_ex en_615 en_615_ex en_616 en_616_ex ' +
      'en_617 en_617_ex en_618 en_618_ex en_619 en_619_ex en_620 en_620_ex en_621 en_621_ex en_622 ' +
      'en_622_ex en_623 en_623_ex en_624 en_624_ex en_625 en_625_ex en_626 en_626_ex en_627 en_627_ex ' +
      'en_628 en_628_ex en_629 en_629_ex en_630 en_630_ex en_631 en_631_ex en_632 en_632_ex en_633 ' +
      'en_633_ex en_634 en_634_ex en_635 en_635_ex en_636 en_636_ex en_637 en_637_ex en_638 en_638_ex ' +
      'en_639 en_639_ex en_640 en_640_ex en_641 en_641_ex en_642 en_642_ex en_643 en_643_ex en_644 ' +
      'en_644_ex en_645 en_645_ex en_646 en_646_ex en_647 en_647_ex en_648 en_648_ex en_649 en_649_ex ' +
      'en_650 en_650_ex en_651 en_651_ex en_652 en_652_ex en_653 en_653_ex en_654 en_654_ex en_655 ' +
      'en_655_ex en_656 en_656_ex en_657 en_657_ex en_658 en_658_ex en_659 en_659_ex en_660 en_660_ex ' +
      'en_661 en_661_ex en_662 en_662_ex en_663 en_663_ex en_664 en_664_ex en_665 en_665_ex en_666 ' +
      'en_666_ex en_667 en_667_ex en_668 en_668_ex en_669 en_669_ex en_670 en_670_ex en_671 en_671_ex ' +
      'en_672 en_672_ex en_673 en_673_ex en_674 en_674_ex en_675 en_675_ex en_676 en_676_ex en_677 ' +
      'en_677_ex en_678 en_678_ex en_679 en_679_ex en_680 en_680_ex en_681 en_681_ex en_682 en_682_ex ' +
      'en_683 en_683_ex en_684 en_684_ex en_685 en_685_ex en_686 en_686_ex en_687 en_687_ex en_688 ' +
      'en_688_ex en_689 en_689_ex en_690 en_690_ex en_691 en_691_ex en_692 en_692_ex en_693 en_693_ex ' +
      'en_694 en_694_ex en_695 en_695_ex en_696 en_696_ex en_697 en_697_ex en_698 en_698_ex en_699 ' +
      'en_699_ex en_700 en_700_ex en_701 en_701_ex en_702 en_702_ex en_703 en_703_ex en_704 en_704_ex ' +
      'en_705 en_705_ex en_706 en_706_ex en_707 en_707_ex en_708 en_708_ex en_709 en_709_ex en_710 ' +
      'en_710_ex en_711 en_711_ex en_712 en_712_ex en_713 en_713_ex en_714 en_714_ex en_715 en_715_ex ' +
      'en_716 en_716_ex en_717 en_717_ex en_718 en_718_ex en_719 en_719_ex en_720 en_720_ex en_721 ' +
      'en_721_ex en_722 en_722_ex en_723 en_723_ex en_724 en_724_ex en_725 en_725_ex en_726 en_726_ex ' +
      'en_727 en_727_ex en_728 en_728_ex en_729 en_729_ex en_730 en_730_ex en_731 en_731_ex en_732 ' +
      'en_732_ex en_733 en_733_ex en_734 en_734_ex en_735 en_735_ex en_736 en_736_ex en_737 en_737_ex ' +
      'en_738 en_738_ex en_739 en_739_ex en_740 en_740_ex en_741 en_741_ex en_742 en_742_ex en_743 ' +
      'en_743_ex en_744 en_744_ex en_745 en_745_ex en_746 en_746_ex en_747 en_747_ex en_748 en_748_ex ' +
      'en_749 en_749_ex en_750 en_750_ex en_751 en_751_ex en_752 en_752_ex en_753 en_753_ex en_754 ' +
      'en_754_ex en_755 en_755_ex en_756 en_756_ex en_757 en_757_ex en_758 en_758_ex en_759 en_759_ex ' +
      'en_760 en_760_ex en_761 en_761_ex en_762 en_762_ex en_763 en_763_ex en_764 en_764_ex en_765 ' +
      'en_765_ex en_766 en_766_ex en_767 en_767_ex en_768 en_768_ex en_769 en_769_ex en_770 en_770_ex ' +
      'en_771 en_771_ex en_772 en_772_ex en_773 en_773_ex en_774 en_774_ex en_775 en_775_ex en_776 ' +
      'en_776_ex en_777 en_777_ex en_778 en_778_ex en_779 en_779_ex en_780 en_780_ex en_781 en_781_ex ' +
      'en_782 en_782_ex en_783 en_783_ex en_784 en_784_ex en_785 en_785_ex en_786 en_786_ex en_787 ' +
      'en_787_ex en_788 en_788_ex en_789 en_789_ex en_790 en_790_ex en_791 en_791_ex en_792 en_792_ex ' +
      'en_793 en_793_ex en_794 en_794_ex en_795 en_795_ex en_796 en_796_ex en_797 en_797_ex en_798 ' +
      'en_798_ex en_799 en_799_ex en_800 en_800_ex s001 s002 s003 s004 s005 s006 s007 s008 s009 s010 s011 ' +
      's012 s013 s014 s015 s016 s017 s018 s019 s020 s021 s022 s023 s024 s025 s026 s027 s028 s029 s030 s031 ' +
      's032 s033 s034 s035 s036 s037 s038 s039 s040 s041 s042 s043 s044 s045 s046 s047 s048 s049 s050 s051 ' +
      's052 s053 s054 s055 s056 s057 s058 s059 s060 s061 s062 s063 s064 s065 s066 s067 s068 s069 s070 s071 ' +
      's072 s073 s074 s075 s076 s077 s078 s079 s080 s081 s082 s083 s084 s085 s086 s087 s088 s089 s090 s091 ' +
      's092 s093 s094 s095 s096 s097 s098 s099 s100 s101 s102 s103 s104 s105 s106 s107 s108 s109 s110 s111 ' +
      's112 s113 s114 s115 s116 s117 s118 s119 s120'
  },
  vi: {
    remote: 'https://yb.qy663.de5.net/audio-vi/',
    count: 304,
    bytes: 1545608,
    ids: 'vd001_1 vd001_2 vd001_3 vd001_4 vd001_5 vd002_1 vd002_2 vd002_3 vd002_4 vd002_5 vd003_1 vd003_2 ' +
      'vd003_3 vd003_4 vd003_5 vd003_6 vd004_1 vd004_2 vd004_3 vd004_4 vd004_5 vd005_1 vd005_2 vd005_3 ' +
      'vd005_4 vd005_5 vd005_6 vd006_1 vd006_2 vd006_3 vd006_4 vd006_5 vd007_1 vd007_2 vd007_3 vd007_4 ' +
      'vd007_5 vd007_6 vd008_1 vd008_2 vd008_3 vd008_4 vd008_5 vd008_6 vi_001 vi_001_ex vi_002 vi_002_ex ' +
      'vi_003 vi_003_ex vi_004 vi_004_ex vi_005 vi_005_ex vi_006 vi_006_ex vi_007 vi_007_ex vi_008 ' +
      'vi_008_ex vi_009 vi_009_ex vi_010 vi_010_ex vi_011 vi_011_ex vi_012 vi_012_ex vi_013 vi_013_ex ' +
      'vi_014 vi_014_ex vi_015 vi_015_ex vi_016 vi_016_ex vi_017 vi_017_ex vi_018 vi_018_ex vi_019 ' +
      'vi_019_ex vi_020 vi_020_ex vi_021 vi_021_ex vi_022 vi_022_ex vi_023 vi_023_ex vi_024 vi_024_ex ' +
      'vi_025 vi_025_ex vi_026 vi_026_ex vi_027 vi_027_ex vi_028 vi_028_ex vi_029 vi_029_ex vi_030 ' +
      'vi_030_ex vi_031 vi_031_ex vi_032 vi_032_ex vi_033 vi_033_ex vi_034 vi_034_ex vi_035 vi_035_ex ' +
      'vi_036 vi_036_ex vi_037 vi_037_ex vi_038 vi_038_ex vi_039 vi_039_ex vi_040 vi_040_ex vi_041 ' +
      'vi_041_ex vi_042 vi_042_ex vi_043 vi_043_ex vi_044 vi_044_ex vi_045 vi_045_ex vi_046 vi_046_ex ' +
      'vi_047 vi_047_ex vi_048 vi_048_ex vi_049 vi_049_ex vi_050 vi_050_ex vi_051 vi_051_ex vi_052 ' +
      'vi_052_ex vi_053 vi_053_ex vi_054 vi_054_ex vi_055 vi_055_ex vi_056 vi_056_ex vi_057 vi_057_ex ' +
      'vi_058 vi_058_ex vi_059 vi_059_ex vi_060 vi_060_ex vi_061 vi_061_ex vi_062 vi_062_ex vi_063 ' +
      'vi_063_ex vi_064 vi_064_ex vi_065 vi_065_ex vi_066 vi_066_ex vi_067 vi_067_ex vi_068 vi_068_ex ' +
      'vi_069 vi_069_ex vi_070 vi_070_ex vi_071 vi_071_ex vi_072 vi_072_ex vi_073 vi_073_ex vi_074 ' +
      'vi_074_ex vi_075 vi_075_ex vi_076 vi_076_ex vi_077 vi_077_ex vi_078 vi_078_ex vi_079 vi_079_ex ' +
      'vi_080 vi_080_ex vs001 vs002 vs003 vs004 vs005 vs006 vs007 vs008 vs009 vs010 vs011 vs012 vs013 vs014 ' +
      'vs015 vs016 vs017 vs018 vs019 vs020 vs021 vs022 vs023 vs024 vs025 vs026 vs027 vs028 vs029 vs030 ' +
      'vs031 vs032 vs033 vs034 vs035 vs036 vs037 vs038 vs039 vs040 vs041 vs042 vs043 vs044 vs045 vs046 ' +
      'vs047 vs048 vs049 vs050 vs051 vs052 vs053 vs054 vs055 vs056 vs057 vs058 vs059 vs060 vs061 vs062 ' +
      'vs063 vs064 vs065 vs066 vs067 vs068 vs069 vs070 vs071 vs072 vs073 vs074 vs075 vs076 vs077 vs078 ' +
      'vs079 vs080 vs081 vs082 vs083 vs084 vs085 vs086 vs087 vs088 vs089 vs090 vs091 vs092 vs093 vs094 ' +
      'vs095 vs096 vs097 vs098 vs099 vs100'
  }
}

// ---- 运行时接口（下面这段被 tools/gen-local-audio.js 原样拼进 utils/local-audio.js）----

// 跟读队列里的素材 id 是「前缀_原始id」（句子 st_s001、对话台词 dl_d003_1），
// 而音频文件名用的是原始 id（s001 / d003_1）。两种都认，否则对话台词永远命中不了。
const ID_PREFIXES = ['st_', 'dl_', 'sp_']
function idCandidates(id) {
  const out = [id]
  for (let i = 0; i < ID_PREFIXES.length; i++) {
    const p = ID_PREFIXES[i]
    if (id.length > p.length && id.indexOf(p) === 0) out.push(id.slice(p.length))
  }
  return out
}

// ids 是「空格分隔的整串」，查表用 indexOf（前后补空格避免 vi_01 命中 vi_010）。
// 这样 722 个 id 的清单只占一个字符串字面量，不用在启动时构建 722 键的对象。
function padded(r) {
  if (!r._pad) r._pad = ' ' + r.ids + ' '
  return r._pad
}
function hasId(r, id) {
  return padded(r).indexOf(' ' + id + ' ') >= 0
}

// 素材 id 属于哪个语种；没有返回空串
function langOf(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    for (let ii = 0; ii < ids.length; ii++) {
      if (hasId(REGION[langs[li]], ids[ii])) return langs[li]
    }
  }
  return ''
}

// 音频在 CDN 上的地址（Pages 部署时会把 audio-src/ 原样铺成 /audio/ 与 /audio-en/）。
// mp3 不进代码包：真机上 FileSystemManager 读不到分包内的文件、InnerAudioContext 也不允许
// 直接播包内 mp3（日志「[pkg-audio] 读不到代码包内的音频」「operateAudio:fail:access denied」），
// 所以随包音频的唯一可用路径就是这条 CDN 流播。
function remoteFor(id) {
  if (!id) return ''
  const langs = Object.keys(REGION)
  const ids = idCandidates(id)
  for (let li = 0; li < langs.length; li++) {
    const r = REGION[langs[li]]
    if (!r.remote) continue
    for (let ii = 0; ii < ids.length; ii++) {
      if (hasId(r, ids[ii])) return r.remote + ids[ii] + '.mp3'
    }
  }
  return ''
}

// 这个 id 有没有现成音频（本地缓存或 CDN 都算）
function has(id) { return !!remoteFor(id) }

function countOf(lang) { return REGION[lang] ? REGION[lang].count : 0 }
function stats() {
  const out = {}
  Object.keys(REGION).forEach(function (k) {
    out[k] = { count: REGION[k].count, bytes: REGION[k].bytes }
  })
  return out
}

const count = Object.keys(REGION).reduce(function (a, k) { return a + REGION[k].count }, 0)

module.exports = {
  REGION: REGION,
  idCandidates: idCandidates,
  remoteFor: remoteFor,
  has: has,
  langOf: langOf,
  countOf: countOf,
  stats: stats,
  count: count
}
