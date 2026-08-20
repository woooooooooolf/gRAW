use super::model::{CfaPattern, RawConfig, TestPattern};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Channel {
    Mono,
    R,
    Gr,
    Gb,
    B,
}

pub fn pixel_value(config: &RawConfig, frame: u32, x: u32, y: u32, max: u16) -> u16 {
    let channel = channel_at(config.cfa_pattern, x, y);
    match config.test_pattern {
        TestPattern::Fixed => fixed_value(config, channel),
        TestPattern::HorizontalGradient => scale_coordinate(x, config.width, max),
        TestPattern::VerticalGradient => scale_coordinate(y, config.height, max),
        TestPattern::GraySteps => {
            let step_count = config.gray_steps as u64;
            let step = ((x as u64 * step_count) / config.width as u64).min(step_count - 1);
            ((step * max as u64) / (step_count - 1)) as u16
        }
        TestPattern::ColorBars => color_bar_value(channel, x, config.width, max),
        TestPattern::ColorGradient => color_gradient_value(channel, x, config.width, max),
        TestPattern::RgbGradient => {
            rgb_gradient_value(channel, x, y, config.width, config.height, max)
        }
        TestPattern::Checkerboard => {
            if ((x / config.checker_size) + (y / config.checker_size)).is_multiple_of(2) {
                max
            } else {
                0
            }
        }
        TestPattern::RandomNoise => {
            let position = y as u64 * config.width as u64 + x as u64;
            let mixed = splitmix64(
                config.noise_seed
                    ^ (frame as u64).wrapping_mul(0xD6E8_FEB8_6659_FD93)
                    ^ position.wrapping_mul(0x9E37_79B9_7F4A_7C15),
            );
            (mixed % (max as u64 + 1)) as u16
        }
        TestPattern::Black => 0,
        TestPattern::White => max,
    }
}

fn fixed_value(config: &RawConfig, channel: Channel) -> u16 {
    match channel {
        Channel::Mono => config.pixel_values.mono,
        Channel::R => config.pixel_values.r,
        Channel::Gr => config.pixel_values.gr,
        Channel::Gb => config.pixel_values.gb,
        Channel::B => config.pixel_values.b,
    }
}

fn scale_coordinate(position: u32, extent: u32, max: u16) -> u16 {
    if extent <= 1 {
        max
    } else {
        ((position as u64 * max as u64) / (extent as u64 - 1)) as u16
    }
}

fn color_bar_value(channel: Channel, x: u32, width: u32, max: u16) -> u16 {
    // SMPTE-inspired order: white, yellow, cyan, green, magenta, red, blue, black.
    let bars = [
        (true, true, true),
        (true, true, false),
        (false, true, true),
        (false, true, false),
        (true, false, true),
        (true, false, false),
        (false, false, true),
        (false, false, false),
    ];
    let index =
        ((x as u64 * bars.len() as u64) / width as u64).min((bars.len() - 1) as u64) as usize;
    let (red, green, blue) = bars[index];
    let enabled = match channel {
        Channel::Mono => red || green || blue,
        Channel::R => red,
        Channel::Gr | Channel::Gb => green,
        Channel::B => blue,
    };
    if enabled { max } else { 0 }
}

fn color_gradient_value(channel: Channel, x: u32, width: u32, max: u16) -> u16 {
    let max = max as u64;
    let phase = if width <= 1 {
        0
    } else {
        x as u64 * 6 * max / (width as u64 - 1)
    };
    let segment = (phase / max).min(5);
    let offset = phase - segment * max;
    let (red, green, blue) = match segment {
        0 => (max, offset, 0),
        1 => (max - offset, max, 0),
        2 => (0, max, offset),
        3 => (0, max - offset, max),
        4 => (offset, 0, max),
        _ => (max, 0, max - offset),
    };
    color_channel_value(channel, red as u16, green as u16, blue as u16)
}

fn rgb_gradient_value(channel: Channel, x: u32, y: u32, width: u32, height: u32, max: u16) -> u16 {
    let intensity = scale_coordinate(x, width, max);
    let band = ((y as u64 * 3) / height as u64).min(2);
    let (red, green, blue) = match band {
        0 => (intensity, 0, 0),
        1 => (0, intensity, 0),
        _ => (0, 0, intensity),
    };
    color_channel_value(channel, red, green, blue)
}

fn color_channel_value(channel: Channel, red: u16, green: u16, blue: u16) -> u16 {
    match channel {
        Channel::Mono => red.max(green).max(blue),
        Channel::R => red,
        Channel::Gr | Channel::Gb => green,
        Channel::B => blue,
    }
}

fn channel_at(cfa: CfaPattern, x: u32, y: u32) -> Channel {
    if cfa == CfaPattern::Mono {
        return Channel::Mono;
    }
    let (column, row) = match cfa {
        CfaPattern::QuadRggb
        | CfaPattern::QuadGrbg
        | CfaPattern::QuadGbrg
        | CfaPattern::QuadBggr => ((x / 2) % 2, (y / 2) % 2),
        _ => (x % 2, y % 2),
    };
    match (base_cfa(cfa), row, column) {
        (CfaPattern::Rggb, 0, 0) => Channel::R,
        (CfaPattern::Rggb, 0, 1) => Channel::Gr,
        (CfaPattern::Rggb, 1, 0) => Channel::Gb,
        (CfaPattern::Rggb, 1, 1) => Channel::B,
        (CfaPattern::Grbg, 0, 0) => Channel::Gr,
        (CfaPattern::Grbg, 0, 1) => Channel::R,
        (CfaPattern::Grbg, 1, 0) => Channel::B,
        (CfaPattern::Grbg, 1, 1) => Channel::Gb,
        (CfaPattern::Gbrg, 0, 0) => Channel::Gb,
        (CfaPattern::Gbrg, 0, 1) => Channel::B,
        (CfaPattern::Gbrg, 1, 0) => Channel::R,
        (CfaPattern::Gbrg, 1, 1) => Channel::Gr,
        (CfaPattern::Bggr, 0, 0) => Channel::B,
        (CfaPattern::Bggr, 0, 1) => Channel::Gb,
        (CfaPattern::Bggr, 1, 0) => Channel::Gr,
        (CfaPattern::Bggr, 1, 1) => Channel::R,
        _ => Channel::Mono,
    }
}

fn base_cfa(cfa: CfaPattern) -> CfaPattern {
    match cfa {
        CfaPattern::QuadRggb => CfaPattern::Rggb,
        CfaPattern::QuadGrbg => CfaPattern::Grbg,
        CfaPattern::QuadGbrg => CfaPattern::Gbrg,
        CfaPattern::QuadBggr => CfaPattern::Bggr,
        other => other,
    }
}

fn splitmix64(mut value: u64) -> u64 {
    value = value.wrapping_add(0x9E37_79B9_7F4A_7C15);
    value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    value ^ (value >> 31)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raw::model::{BitAlignment, Endianness, PixelValues, StorageFormat};

    fn config(cfa_pattern: CfaPattern) -> RawConfig {
        RawConfig {
            width: 8,
            height: 8,
            bit_depth: 10,
            storage_format: StorageFormat::Unpacked16,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa_pattern,
            test_pattern: TestPattern::Fixed,
            pixel_values: PixelValues {
                mono: 1,
                r: 2,
                gr: 3,
                gb: 4,
                b: 5,
            },
            gray_steps: 4,
            checker_size: 2,
            noise_seed: 1,
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
    fn maps_rggb_channels() {
        let config = config(CfaPattern::Rggb);
        assert_eq!(pixel_value(&config, 0, 0, 0, 1023), 2);
        assert_eq!(pixel_value(&config, 0, 1, 0, 1023), 3);
        assert_eq!(pixel_value(&config, 0, 0, 1, 1023), 4);
        assert_eq!(pixel_value(&config, 0, 1, 1, 1023), 5);
    }

    #[test]
    fn expands_quad_cfa_to_two_by_two_blocks() {
        let config = config(CfaPattern::QuadRggb);
        assert_eq!(pixel_value(&config, 0, 0, 0, 1023), 2);
        assert_eq!(pixel_value(&config, 0, 1, 1, 1023), 2);
        assert_eq!(pixel_value(&config, 0, 2, 0, 1023), 3);
        assert_eq!(pixel_value(&config, 0, 0, 2, 1023), 4);
        assert_eq!(pixel_value(&config, 0, 2, 2, 1023), 5);
    }

    #[test]
    fn noise_is_deterministic_and_varies_by_frame() {
        let mut config = config(CfaPattern::Mono);
        config.test_pattern = TestPattern::RandomNoise;
        let first = pixel_value(&config, 0, 3, 4, 1023);
        assert_eq!(first, pixel_value(&config, 0, 3, 4, 1023));
        assert_ne!(first, pixel_value(&config, 1, 3, 4, 1023));
    }

    #[test]
    fn generates_color_gradient_hue_anchors() {
        let expected = [
            (600, 0, 0),
            (600, 600, 0),
            (0, 600, 0),
            (0, 600, 600),
            (0, 0, 600),
            (600, 0, 600),
            (600, 0, 0),
        ];
        for (x, (red, green, blue)) in expected.into_iter().enumerate() {
            assert_eq!(color_gradient_value(Channel::R, x as u32, 7, 600), red);
            assert_eq!(color_gradient_value(Channel::Gr, x as u32, 7, 600), green);
            assert_eq!(color_gradient_value(Channel::B, x as u32, 7, 600), blue);
        }
    }

    #[test]
    fn generates_separate_rgb_gradient_bands() {
        assert_eq!(rgb_gradient_value(Channel::R, 4, 0, 5, 9, 1023), 1023);
        assert_eq!(rgb_gradient_value(Channel::Gr, 4, 0, 5, 9, 1023), 0);
        assert_eq!(rgb_gradient_value(Channel::R, 4, 3, 5, 9, 1023), 0);
        assert_eq!(rgb_gradient_value(Channel::Gb, 4, 3, 5, 9, 1023), 1023);
        assert_eq!(rgb_gradient_value(Channel::B, 4, 6, 5, 9, 1023), 1023);
    }
}
