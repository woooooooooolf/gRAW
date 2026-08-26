use super::model::{BitAlignment, Endianness, RawConfig, StorageFormat};

pub fn pack_row(config: &RawConfig, pixels: &[u16], output: &mut Vec<u8>) {
    output.clear();
    match config.storage_format {
        StorageFormat::Unpacked8 => {
            output.extend(pixels.iter().map(|&value| value as u8));
        }
        StorageFormat::Unpacked16 => pack_unpacked16(config, pixels, output),
        StorageFormat::Mipi10 => pack_mipi10(pixels, output),
        StorageFormat::Mipi12 => pack_mipi12(pixels, output),
        StorageFormat::Mipi14 => pack_mipi14(pixels, output),
    }
}

fn pack_unpacked16(config: &RawConfig, pixels: &[u16], output: &mut Vec<u8>) {
    let shift = if config.bit_alignment == BitAlignment::Msb {
        16 - config.bit_depth
    } else {
        0
    };
    output.reserve(pixels.len() * 2);
    for &pixel in pixels {
        let value = pixel << shift;
        let bytes = match config.endianness {
            Endianness::Little => value.to_le_bytes(),
            Endianness::Big => value.to_be_bytes(),
        };
        output.extend_from_slice(&bytes);
    }
}

fn pack_mipi10(pixels: &[u16], output: &mut Vec<u8>) {
    output.reserve(pixels.len() / 4 * 5);
    for group in pixels.as_chunks::<4>().0 {
        output.extend_from_slice(&[
            (group[0] >> 2) as u8,
            (group[1] >> 2) as u8,
            (group[2] >> 2) as u8,
            (group[3] >> 2) as u8,
            ((group[0] & 0x03)
                | ((group[1] & 0x03) << 2)
                | ((group[2] & 0x03) << 4)
                | ((group[3] & 0x03) << 6)) as u8,
        ]);
    }
}

fn pack_mipi12(pixels: &[u16], output: &mut Vec<u8>) {
    output.reserve(pixels.len() / 2 * 3);
    for group in pixels.as_chunks::<2>().0 {
        output.extend_from_slice(&[
            (group[0] >> 4) as u8,
            (group[1] >> 4) as u8,
            ((group[0] & 0x0f) | ((group[1] & 0x0f) << 4)) as u8,
        ]);
    }
}

fn pack_mipi14(pixels: &[u16], output: &mut Vec<u8>) {
    output.reserve(pixels.len() / 4 * 7);
    for group in pixels.as_chunks::<4>().0 {
        output.extend_from_slice(&[
            (group[0] >> 6) as u8,
            (group[1] >> 6) as u8,
            (group[2] >> 6) as u8,
            (group[3] >> 6) as u8,
            ((group[0] & 0x3f) | ((group[1] & 0x03) << 6)) as u8,
            (((group[1] >> 2) & 0x0f) | ((group[2] & 0x0f) << 4)) as u8,
            (((group[2] >> 4) & 0x03) | ((group[3] & 0x3f) << 2)) as u8,
        ]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::model::{CfaPattern, PixelValues, TestPattern};

    fn config(format: StorageFormat, depth: u8) -> RawConfig {
        RawConfig {
            width: 4,
            height: 1,
            bit_depth: depth,
            storage_format: format,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa_pattern: CfaPattern::Mono,
            test_pattern: TestPattern::Fixed,
            pixel_values: PixelValues {
                mono: 0,
                r: 0,
                gr: 0,
                gb: 0,
                b: 0,
            },
            gray_steps: 2,
            checker_size: 1,
            noise_seed: 0,
            row_alignment: 1,
            frame_alignment: 1,
            file_offset: 0,
            offset_fill: 0,
            row_padding_fill: 0,
            frame_padding_fill: 0,
            frame_count: 1,
        }
    }

    #[test]
    fn packs_mipi_raw10() {
        let mut output = Vec::new();
        pack_row(
            &config(StorageFormat::Mipi10, 10),
            &[0x03ff, 0x0000, 0x0155, 0x02aa],
            &mut output,
        );
        assert_eq!(output, [0xff, 0x00, 0x55, 0xaa, 0x93]);
    }

    #[test]
    fn packs_mipi_raw12() {
        let mut output = Vec::new();
        pack_row(
            &config(StorageFormat::Mipi12, 12),
            &[0x0abc, 0x0123],
            &mut output,
        );
        assert_eq!(output, [0xab, 0x12, 0x3c]);
    }

    #[test]
    fn packs_mipi_raw14() {
        let mut output = Vec::new();
        pack_row(
            &config(StorageFormat::Mipi14, 14),
            &[0x3fff, 0x0000, 0x1555, 0x2aaa],
            &mut output,
        );
        assert_eq!(output, [0xff, 0x00, 0x55, 0xaa, 0x3f, 0x50, 0xa9]);
    }

    #[test]
    fn packs_msb_aligned_big_endian_unpacked16() {
        let mut config = config(StorageFormat::Unpacked16, 10);
        config.endianness = Endianness::Big;
        config.bit_alignment = BitAlignment::Msb;
        let mut output = Vec::new();
        pack_row(&config, &[0x03ff, 0x0001], &mut output);
        assert_eq!(output, [0xff, 0xc0, 0x00, 0x40]);
    }
}
