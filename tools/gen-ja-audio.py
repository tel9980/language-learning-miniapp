# -*- coding: utf-8 -*-
"""生成日语离线音频（句子 / 情景对话台词 / 单词）。

为什么需要它：日语整句没有可用的免费在线合成源——
有道 dictvoice 只对单词有效（且必须带 le=jap），百度 lan=jap 返回 403，
同声传译 textToSpeech 只支持中英文。所以日语素材的音频随小程序包一起发：
不用密钥、不用后端、断网也能听。

用法：
    node tools/dump-ja-items.js /tmp/ja_items.json
    python3 tools/gen-ja-audio.py --items /tmp/ja_items.json --out assets/audio/ja

依赖：pip install --break-system-packages edge-tts imageio-ffmpeg
（edge-tts 走微软 Edge 朗读通道，免费无需密钥；ffmpeg 把 48kbps 压到 16kbps）
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile

VOICE = 'ja-JP-NanamiNeural'   # 日语女声；男声用 ja-JP-KeitaNeural
LIMIT = 1                      # 并发数，太大容易被限流
TARGET = ('-ar', '16000', '-ac', '1', '-b:a', '16k')


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def compress(exe, src, dst):
    subprocess.run([exe, '-y', '-loglevel', 'error', '-i', src] + list(TARGET) + [dst], check=True)


async def one(sem, exe, item, outdir, redownload):
    import edge_tts
    dst = os.path.join(outdir, item['id'] + '.mp3')
    if os.path.exists(dst) and not redownload:
        return 'skip'
    async with sem:
        raw = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
        raw.close()
        try:
            await edge_tts.Communicate(item['text'], VOICE).save(raw.name)
            await asyncio.get_event_loop().run_in_executor(None, compress, exe, raw.name, dst)
            return 'ok'
        finally:
            if os.path.exists(raw.name):
                os.unlink(raw.name)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--items', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--force', action='store_true', help='重新生成已存在的文件')
    args = ap.parse_args()

    data = json.load(open(args.items, encoding='utf-8'))
    items = data['sentences'] + data['dialogues'] + data['words']
    os.makedirs(args.out, exist_ok=True)
    exe = ffmpeg()
    sem = asyncio.Semaphore(LIMIT)
    results = await asyncio.gather(*[one(sem, exe, it, args.out, args.force) for it in items],
                                  return_exceptions=True)
    bad = [r for r in results if isinstance(r, Exception)]
    total = sum(os.path.getsize(os.path.join(args.out, f)) for f in os.listdir(args.out) if f.endswith('.mp3'))
    print('生成 %d 条（跳过 %d，失败 %d），合计 %.1f KB'
          % (results.count('ok'), results.count('skip'), len(bad), total / 1024.0))
    for b in bad[:5]:
        print('  ✗', b)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
