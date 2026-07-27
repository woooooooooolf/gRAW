use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StorageFormat {
    Unpacked8,
    Unpacked16,
    Mipi10,
    Mipi12,
    Mipi14,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Endianness {
    Little,
    Big,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BitAlignment {
    Lsb,
    Msb,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CfaPattern {
    Mono,
    Rggb,
    Grbg,
    Gbrg,
    Bggr,
    QuadRggb,
    QuadGrbg,
    QuadGbrg,
    QuadBggr,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TestPattern {
    Fixed,
    HorizontalGradient,
    VerticalGradient,
    GraySteps,
    ColorBars,
    ColorGradient,
    RgbGradient,
    Checkerboard,
    RandomNoise,
    Black,
    White,
}

impl TestPattern {
    fn requires_color_cfa(self) -> bool {
        matches!(
            self,
            Self::ColorBars | Self::ColorGradient | Self::RgbGradient
        )
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelValues {
    pub mono: u16,
    pub r: u16,
    pub gr: u16,
    pub gb: u16,
    pub b: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawConfig {
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub storage_format: StorageFormat,
    pub endianness: Endianness,
    pub bit_alignment: BitAlignment,
    pub cfa_pattern: CfaPattern,
    pub test_pattern: TestPattern,
    pub pixel_values: PixelValues,
    pub gray_steps: u16,
    pub checker_size: u32,
    pub noise_seed: u64,
    pub row_alignment: u32,
    pub frame_alignment: u32,
    pub file_offset: u64,
    pub offset_fill: u8,
    pub row_padding_fill: u8,
    pub frame_padding_fill: u8,
    pub frame_count: u32,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameLayout {
    pub max_value: u16,
    pub row_payload: u64,
    pub row_stride: u64,
    pub row_padding: u64,
    pub frame_data: u64,
    pub frame_stride: u64,
    pub frame_padding: u64,
    pub total_size: u64,
}

impl RawConfig {
    pub fn validate(&self) -> Result<FrameLayout, String> {
        if self.width == 0 || self.height == 0 {
            return Err("图像宽度和高度必须大于 0".into());
        }
        if self.frame_count == 0 {
            return Err("帧数量必须大于 0".into());
        }
        if self.row_alignment == 0 || self.frame_alignment == 0 {
            return Err("行对齐和帧对齐必须大于 0".into());
        }
        if !(8..=16).contains(&self.bit_depth) {
            return Err("位深必须在 8 到 16 bit 之间".into());
        }

        match self.storage_format {
            StorageFormat::Unpacked8 if self.bit_depth != 8 => {
                return Err("Unpacked8 仅支持 8 bit".into());
            }
            StorageFormat::Unpacked16 => {}
            StorageFormat::Mipi10 if self.bit_depth != 10 => {
                return Err("MIPI10 仅支持 10 bit".into());
            }
            StorageFormat::Mipi12 if self.bit_depth != 12 => {
                return Err("MIPI12 仅支持 12 bit".into());
            }
            StorageFormat::Mipi14 if self.bit_depth != 14 => {
                return Err("MIPI14 仅支持 14 bit".into());
            }
            _ => {}
        }

        match self.storage_format {
            StorageFormat::Mipi10 | StorageFormat::Mipi14 if self.width % 4 != 0 => {
                return Err("MIPI10/MIPI14 的宽度必须是 4 的倍数".into());
            }
            StorageFormat::Mipi12 if self.width % 2 != 0 => {
                return Err("MIPI12 的宽度必须是 2 的倍数".into());
            }
            _ => {}
        }

        if self.cfa_pattern == CfaPattern::Mono && self.test_pattern.requires_color_cfa() {
            return Err("Mono CFA 不支持彩色测试图案".into());
        }
        if self.test_pattern == TestPattern::GraySteps && !(2..=256).contains(&self.gray_steps) {
            return Err("灰阶数量必须在 2 到 256 之间".into());
        }
        if self.test_pattern == TestPattern::Checkerboard && self.checker_size == 0 {
            return Err("棋盘格单元尺寸必须大于 0".into());
        }

        let max_value = if self.bit_depth == 16 {
            u16::MAX
        } else {
            ((1u32 << self.bit_depth) - 1) as u16
        };
        for (name, value) in [
            ("Mono", self.pixel_values.mono),
            ("R", self.pixel_values.r),
            ("Gr", self.pixel_values.gr),
            ("Gb", self.pixel_values.gb),
            ("B", self.pixel_values.b),
        ] {
            if value > max_value {
                return Err(format!("{name} 像素值超过当前位深的最大值 {max_value}"));
            }
        }

        let row_payload = match self.storage_format {
            StorageFormat::Unpacked8 => self.width as u64,
            StorageFormat::Unpacked16 => checked_mul(self.width as u64, 2, "行字节数溢出")?,
            StorageFormat::Mipi10 => checked_mul(self.width as u64 / 4, 5, "行字节数溢出")?,
            StorageFormat::Mipi12 => checked_mul(self.width as u64 / 2, 3, "行字节数溢出")?,
            StorageFormat::Mipi14 => checked_mul(self.width as u64 / 4, 7, "行字节数溢出")?,
        };
        let row_stride = align_up(row_payload, self.row_alignment as u64)?;
        let frame_data = checked_mul(row_stride, self.height as u64, "单帧大小溢出")?;
        let frame_stride = align_up(frame_data, self.frame_alignment as u64)?;
        let frames_size = checked_mul(frame_stride, self.frame_count as u64, "多帧大小溢出")?;
        let total_size = self
            .file_offset
            .checked_add(frames_size)
            .ok_or_else(|| "文件总大小溢出 64-bit 范围".to_string())?;

        Ok(FrameLayout {
            max_value,
            row_payload,
            row_stride,
            row_padding: row_stride - row_payload,
            frame_data,
            frame_stride,
            frame_padding: frame_stride - frame_data,
            total_size,
        })
    }
}

fn checked_mul(left: u64, right: u64, message: &str) -> Result<u64, String> {
    left.checked_mul(right).ok_or_else(|| message.to_string())
}

fn align_up(value: u64, alignment: u64) -> Result<u64, String> {
    let remainder = value % alignment;
    if remainder == 0 {
        Ok(value)
    } else {
        value
            .checked_add(alignment - remainder)
            .ok_or_else(|| "对齐计算溢出 64-bit 范围".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_config() -> RawConfig {
        RawConfig {
            width: 1920,
            height: 1080,
            bit_depth: 10,
            storage_format: StorageFormat::Mipi10,
            endianness: Endianness::Little,
            bit_alignment: BitAlignment::Lsb,
            cfa_pattern: CfaPattern::Rggb,
            test_pattern: TestPattern::Fixed,
            pixel_values: PixelValues {
                mono: 512,
                r: 1023,
                gr: 512,
                gb: 512,
                b: 0,
            },
            gray_steps: 16,
            checker_size: 64,
            noise_seed: 1,
            row_alignment: 64,
            frame_alignment: 4096,
            file_offset: 128,
            offset_fill: 0,
            row_padding_fill: 0,
            frame_padding_fill: 0,
            frame_count: 2,
        }
    }

    #[test]
    fn calculates_aligned_layout() {
        let layout = base_config().validate().unwrap();
        assert_eq!(layout.row_payload, 2400);
        assert_eq!(layout.row_stride, 2432);
        assert_eq!(layout.frame_data, 2_626_560);
        assert_eq!(layout.frame_stride, 2_629_632);
        assert_eq!(layout.total_size, 5_259_392);
    }

    #[test]
    fn rejects_invalid_mipi_width() {
        let mut config = base_config();
        config.width = 1919;
        assert!(config.validate().unwrap_err().contains("4 的倍数"));
    }

    #[test]
    fn rejects_color_patterns_for_mono_cfa() {
        for test_pattern in [
            TestPattern::ColorBars,
            TestPattern::ColorGradient,
            TestPattern::RgbGradient,
        ] {
            let mut config = base_config();
            config.cfa_pattern = CfaPattern::Mono;
            config.test_pattern = test_pattern;
            assert!(config.validate().unwrap_err().contains("Mono CFA"));
        }
    }
}
