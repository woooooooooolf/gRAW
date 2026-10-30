import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import test, { after } from "node:test";

const exe = resolve(process.env.GRAW_EXE || "src-tauri/target/release/graw.exe");
assert.ok(existsSync(exe), "Build the release executable first, or set GRAW_EXE.");
const directory = mkdtempSync(join(tmpdir(), "graw-cli-"));
after(() => {
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("graw-cli-"));
  rmSync(directory, { recursive: true, force: true });
});
let serial = 0;

function argumentsFor(overrides = {}) {
  const config = {
    width: 4, height: 2, "storage-format": "mipi10", "bit-depth": 10,
    "cfa-pattern": "mono", "test-pattern": "white", "frame-count": 1,
    "row-alignment": 1, "frame-alignment": 1, "file-offset": 0,
    ...overrides,
  };
  return Object.entries(config).flatMap(([key, value]) => value === undefined ? [] : ["--" + key, String(value)]);
}

function run(args, options = {}) {
  const result = spawnSync(exe, args, { encoding: "utf8", timeout: 20_000, windowsHide: true, ...options });
  assert.ifError(result.error);
  assert.notEqual(result.status, null, "No exit status: " + result.stderr);
  return result;
}

function generate(overrides = {}, extra = []) {
  const output = join(directory, "图像 空格-" + (++serial) + ".raw");
  const result = run(["--output", output, ...argumentsFor(overrides), ...extra]);
  assert.equal(result.status, 0, result.stderr);
  return { ...result, output, bytes: readFileSync(output) };
}

test("help/version terminate successfully without generation", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--row-padding-fill/);
  assert.match(help.stdout, /--output/);
  assert.equal(help.stderr, "");
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(version.stdout.includes(manifest.version));
});

test("all base generation parameters must be explicit", () => {
  const baseline = argumentsFor();
  for (let index = 0; index < baseline.length; index += 2) {
    const args = baseline.filter((_, at) => at !== index && at !== index + 1);
    const result = run(["--dry-run", ...args]);
    assert.equal(result.status, 2, baseline[index]);
    assert.ok(result.stderr.includes(baseline[index]), result.stderr);
  }
  assert.equal(run(argumentsFor()).status, 2, "output is required for real generation");
});

test("dry-run prints exact layout without touching an existing target", () => {
  const output = join(directory, "dry-run.raw");
  writeFileSync(output, "original");
  const result = run(["--dry-run", "--output", output, ...argumentsFor({
    "row-alignment": 8, "frame-alignment": 32, "frame-count": 2,
    "file-offset": 4, "offset-fill": "0xa5",
    "row-padding-fill": "0xcc", "frame-padding-fill": "0x5a",
  })]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /row-payload: 5\nrow-stride: 8\nrow-padding: 3/);
  assert.match(result.stdout, /frame-stride: 32\nframe-padding: 16\ntotal-size: 68/);
  assert.equal(readFileSync(output, "utf8"), "original");
});

test("known bytes for every format and unpacked16 alignment/endian combination", () => {
  const cases = [
    [{ "storage-format": "unpacked8", "bit-depth": 8, mono: "0xab" }, [0xab,0xab,0xab,0xab]],
    [{ "storage-format": "mipi10", mono: "0x2a5" }, [0xa9,0xa9,0xa9,0xa9,0x55]],
    [{ "storage-format": "mipi12", "bit-depth": 12, mono: "0xabc" }, [0xab,0xab,0xcc,0xab,0xab,0xcc]],
    [{ "storage-format": "mipi14", "bit-depth": 14, mono: "0x1234" }, [0x48,0x48,0x48,0x48,0x34,0x4d,0xd3]],
    [{ "storage-format": "unpacked16", endianness: "little", "bit-alignment": "lsb", mono: "0x155" }, [0x55,0x01]],
    [{ "storage-format": "unpacked16", endianness: "big", "bit-alignment": "lsb", mono: "0x155" }, [0x01,0x55]],
    [{ "storage-format": "unpacked16", endianness: "little", "bit-alignment": "msb", mono: "0x155" }, [0x40,0x55]],
    [{ "storage-format": "unpacked16", endianness: "big", "bit-alignment": "msb", mono: "0x155" }, [0x55,0x40]],
  ];
  for (const [config, expected] of cases) {
    const result = generate({ height: 1, "test-pattern": "fixed", ...config });
    const bytes = expected.length === 2 ? Array(4).fill(expected).flat() : expected;
    assert.deepEqual([...result.bytes], bytes, JSON.stringify(config));
  }
});

test("fixed CFA samples preserve all four channels, including Quad Bayer", () => {
  const matrices = {
    rggb: [1,2,3,4], grbg: [2,1,4,3], gbrg: [3,4,1,2], bggr: [4,3,2,1],
  };
  for (const quad of [false, true]) {
    for (const [cfa, matrix] of Object.entries(matrices)) {
      const config = { height: 4, "storage-format": "unpacked8", "bit-depth": 8,
        "cfa-pattern": quad ? "quad-" + cfa : cfa, "test-pattern": "fixed", r: 1, gr: 2, gb: 3, b: 4 };
      const result = generate(config);
      const expected = Array.from({ length: 16 }, (_, i) => {
        const x = i % 4, y = Math.floor(i/4), step = quad ? 2 : 1;
        return matrix[(Math.floor(y/step)%2)*2 + Math.floor(x/step)%2];
      });
      assert.deepEqual([...result.bytes], expected, config["cfa-pattern"]);
    }
  }
});

test("all eleven patterns work with all five storage formats", () => {
  const patterns = {
    fixed: { mono: 7 }, "horizontal-gradient": {}, "vertical-gradient": {},
    "gray-steps": { "gray-steps": 4 }, checkerboard: { "checker-size": 1 },
    "random-noise": { "noise-seed": 123 }, black: {}, white: {},
    "color-bars": { "cfa-pattern": "rggb" },
    "color-gradient": { "cfa-pattern": "rggb" },
    "rgb-gradient": { "cfa-pattern": "rggb" },
  };
  for (const [format, depth, rowSize] of [
    ["unpacked8",8,4], ["unpacked16",10,8], ["mipi10",10,5], ["mipi12",12,6], ["mipi14",14,7],
  ]) {
    for (const [pattern, options] of Object.entries(patterns)) {
      const result = generate({ "storage-format": format, "bit-depth": depth,
        "test-pattern": pattern, ...(format === "unpacked16" ? { endianness: "little", "bit-alignment": "lsb" } : {}), ...options });
      assert.equal(result.bytes.length, rowSize*2, format + "/" + pattern);
    }
  }
});

test("explicit noise seed is deterministic and produces different frames", () => {
  const config = { width: 16, height: 8, "frame-count": 2, "test-pattern": "random-noise", "noise-seed": 1234 };
  const first = generate(config).bytes;
  assert.deepEqual(generate(config).bytes, first);
  assert.notDeepEqual(first.subarray(0, first.length/2), first.subarray(first.length/2));
  assert.notDeepEqual(generate({ ...config, "noise-seed": 4321 }).bytes, first);
});

test("offset/row/frame fills and overwrite produce an exact 68-byte file", () => {
  const config = { "row-alignment": 8, "frame-alignment": 32, "frame-count": 2,
    "file-offset": 4, "offset-fill": "0xa5", "row-padding-fill": "0xcc", "frame-padding-fill": "0x5a" };
  const output = join(directory, "overwrite.raw");
  writeFileSync(output, Buffer.alloc(100, 0x11));
  const result = run(["--output", output, ...argumentsFor(config)]);
  assert.equal(result.status, 0, result.stderr);
  const frame = [...Array(2)].flatMap(() => [...Array(5).fill(0xff), ...Array(3).fill(0xcc)]).concat(Array(16).fill(0x5a));
  assert.deepEqual([...readFileSync(output)], [...Array(4).fill(0xa5), ...frame, ...frame]);
  assert.ok(!readdirSync(directory).some(name => name.startsWith("overwrite.raw.graw.")));
});

test("conditional parameters cannot be omitted or silently ignored", () => {
  for (const [config, flag] of [
    [{ "test-pattern": "fixed" }, "--mono"],
    [{ "test-pattern": "fixed", "cfa-pattern": "rggb" }, "--r"],
    [{ "test-pattern": "gray-steps" }, "--gray-steps"],
    [{ "test-pattern": "checkerboard" }, "--checker-size"],
    [{ "test-pattern": "random-noise" }, "--noise-seed"],
    [{ "file-offset": 1 }, "--offset-fill"],
    [{ "row-alignment": 8 }, "--row-padding-fill"],
    [{ "frame-alignment": 32 }, "--frame-padding-fill"],
    [{ "storage-format": "unpacked16" }, "--endianness"],
    [{ "noise-seed": 0 }, "--noise-seed"],
    [{ "row-padding-fill": 0 }, "--row-padding-fill"],
    [{ endianness: "little" }, "--endianness"],
  ]) {
    const result = run(["--dry-run", ...argumentsFor(config)]);
    assert.equal(result.status, 2, JSON.stringify(config));
    assert.ok(result.stderr.includes(flag), result.stderr);
  }
});

test("invalid input names its parameter and preserves existing output", () => {
  const output = join(directory, "invalid.raw");
  writeFileSync(output, "preserve");
  for (const [config, flag] of [
    [{ width: 3 }, "--width"], [{ "bit-depth": 12 }, "--bit-depth"],
    [{ width: 0 }, "--width"], [{ height: 1_000_001 }, "--height"],
    [{ "row-alignment": 0 }, "--row-alignment"], [{ "frame-count": 0 }, "--frame-count"],
    [{ "file-offset": "9007199254740992" }, "--file-offset"],
    [{ "test-pattern": "color-bars" }, "--test-pattern"],
    [{ "test-pattern": "fixed", mono: 1024 }, "--mono"],
    [{ "test-pattern": "gray-steps", "gray-steps": 1 }, "--gray-steps"],
    [{ "test-pattern": "checkerboard", "checker-size": 0 }, "--checker-size"],
    [{ "test-pattern": "random-noise", "noise-seed": "9007199254740992" }, "--noise-seed"],
    [{ "offset-fill": 256 }, "--offset-fill"],
    [{ width: "not-a-number" }, "--width"],
    [{ "test-pattern": "nonexistent" }, "--test-pattern"],
  ]) {
    const result = run(["--output", output, ...argumentsFor(config)]);
    assert.equal(result.status, 2, JSON.stringify(config));
    assert.ok(result.stderr.includes(flag), result.stderr);
    assert.equal(readFileSync(output, "utf8"), "preserve");
  }
  assert.equal(run(["--dry-run", ...argumentsFor(), "--unknown"]).status, 2);
  assert.equal(run(["--dry-run", ...argumentsFor(), "--width", "4"]).status, 2);
  assert.equal(run(["--output", "", ...argumentsFor()]).status, 2);
});

test("path errors use code 3, and quiet keeps errors visible", () => {
  const result = run(["--quiet", "--output", join(directory, "missing", "out.raw"), ...argumentsFor()]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /--output/);
  assert.equal(result.stdout, "");
  assert.equal(run(["--output", directory, ...argumentsFor()]).status, 3);
  const quiet = generate({}, ["--quiet"]);
  assert.equal(quiet.stdout, "");
  assert.equal(quiet.stderr, "");
});

test("relative paths use caller cwd and get no implicit extension", () => {
  const result = run(["--output", "exact-name", ...argumentsFor()], { cwd: directory });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(directory, "exact-name")).length, 10);
  assert.equal(existsSync(join(directory, "exact-name.raw")), false);
});