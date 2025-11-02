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
  // 原始颜色映射（默认颜色值）
  originalColors: {
    A: '#FFFFFF',  // 字符颜色（白色）
    B: '#8B1A1A',  // 主体颜色（深红色）
    C: '#FF8C42',  // 色带颜色一（深橙色）
    D: '#FFB884',  // 色带颜色二（浅橙色）
    E: '#FFCFA8',  // 色带颜色三（更浅的橙色）
    F: '#FFE4C8'   // 色带颜色四（米色）
  },
  
  // 图层路径（图层叠加顺序：Frame -> A -> B -> C -> D -> E -> F）
  layerPaths: {
    Frame: 'assets/Frame.png',  // 线框图层（最顶层）
    A: 'assets/A.png',          // 字符颜色图层
    B: 'assets/B.png',          // 主体颜色图层
    C: 'assets/C.png',          // 色带颜色一图层
    D: 'assets/D.png',          // 色带颜色二图层
    E: 'assets/E.png',          // 色带颜色三图层
    F: 'assets/F.png'           // 色带颜色四图层
  },
  
  // 色卡图片路径
  colorCardPaths: {
    plate: 'assets/plate.png'  // 色号 1-180（12行15列）
  },
  
  // 色卡布局配置
  colorCardLayout: {
    rows: 12,     // 12行
    cols: 15,     // 15列
    start: 1,     // 起始编号
    end: 180      // 结束编号
  }
};

