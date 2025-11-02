/*
 * @Author: Cheng Wei
 * @Date: 2025-11-02 12:42:21
 * @LastEditTime: 2025-11-02 13:08:31
 * @LastEditors: Cheng Wei
 * @Description: 
 * @FilePath: \wukds-custom-keycap-preview\config.js
 * @GitHub: https://github.com/glegoo
 */
// 键帽配色预览工具配置文件

const CONFIG = {
  // 原始颜色映射（从原图提取）
  // 这些颜色将用于匹配原图中的对应区域
  originalColors: {
    A: '#FFFFFF',  // 字符颜色（白色）
    B: '#8B1A1A',  // 主体颜色（深红色）
    C: '#FF8C42',  // 色带颜色一（深橙色）
    D: '#FFB884',  // 色带颜色二（浅橙色）
    E: '#FFCFA8',  // 色带颜色三（更浅的橙色）
    F: '#FFE4C8'   // 色带颜色四（米色）
  },


  // 颜色匹配容差（RGB差值，用于匹配相似颜色）
  // 增加容差范围，以匹配更多相似颜色（如rgb(5,5,5)和rgb(5,5,6)）
  // 背景颜色也需要匹配，所以容差设置较大
  colorTolerance: 30,
  
  // 背景颜色匹配的特殊容差（用于匹配背景中的相似颜色）
  // 背景可能有渐变和抗锯齿，需要更大的容差
  backgroundTolerance: 80,

  // 图片路径
  imagePath: 'assets/original.png',
  
  // 颜色图层路径（用于精确定位颜色区域）
  layerPaths: {
    A: 'assets/layer_A.png',  // 字符颜色图层
    B: 'assets/layer_B.png',  // 主体颜色图层
    C: 'assets/layer_C.png',  // 色带颜色一图层
    D: 'assets/layer_D.png',  // 色带颜色二图层
    E: 'assets/layer_E.png',  // 色带颜色三图层
    F: 'assets/layer_F.png'   // 色带颜色四图层
  },
  
  // 背景颜色图层路径
  bgLayerPaths: {
    B: 'assets/bg_b.png',  // B的背景图层
    C: 'assets/bg_c.png',  // C的背景图层
    D: 'assets/bg_d.png',  // D的背景图层
    E: 'assets/bg_e.png',  // E的背景图层
    F: 'assets/bg_f.png'   // F的背景图层
  },
  
  // 原始背景颜色（用于计算亮度系数）
  originalBgColors: {
    B: '#5B090D',  // B的原始背景颜色
    C: '#CD5C22',  // C的原始背景颜色
    D: null,       // D的原始背景颜色（需要根据C的系数计算）
    E: null,       // E的原始背景颜色（需要根据C的系数计算）
    F: null        // F的原始背景颜色（需要根据C的系数计算）
  },
  
  // 亮度系数（背景颜色相对于主颜色的亮度比例）
  // 通过原始颜色计算得出：bg_color / main_color 的RGB通道比例
  brightnessCoefficients: {
    B: { r: 91/175, g: 9/19, b: 13/19 },    // B: #AF1313 -> #5B090D
    C: { r: 205/255, g: 92/129, b: 34/46 }, // C: #FF812E -> #CD5C22
    D: null,  // 使用C的系数
    E: null,  // 使用C的系数
    F: null   // 使用C的系数
  },
  
  // 色卡图片路径
  colorCardPaths: {
    card1: 'assets/card1-90.png',  // 色号 1-90
    card2: 'assets/card91-180.png' // 色号 91-180
  },
  
  // 色卡布局配置
  colorCardLayout: {
    rows: 9,      // 9行
    cols: 10,     // 10列
    card1Start: 1,   // 第一张卡起始编号
    card1End: 90,    // 第一张卡结束编号
    card2Start: 91,  // 第二张卡起始编号
    card2End: 180    // 第二张卡结束编号
  }
};

