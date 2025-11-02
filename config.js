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
  colorTolerance: 50,
  
  // 背景颜色匹配的特殊容差（用于匹配背景中的相似颜色）
  // 背景可能有渐变和抗锯齿，需要更大的容差
  backgroundTolerance: 80,

  // 图片路径
  imagePath: 'assets/original.png',
  
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

