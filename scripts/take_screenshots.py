import pyautogui
import time
from pathlib import Path

# 通过脚本位置推导项目根目录和输出路径
project_root = Path(__file__).resolve().parent.parent
output_dir = project_root / 'docs' / 'images'
output_dir.mkdir(parents=True, exist_ok=True)

# 等待2秒准备
print("准备截图，请切换到桌面龙虾窗口...")
time.sleep(2)

# 截图1: 桌面龙虾主界面
print("截图1: 主界面...")
screenshot1 = pyautogui.screenshot()
screenshot1.save(str(output_dir / "main-interface.png"))
print("✅ 保存: main-interface.png")

time.sleep(1)

# 截图2: 全屏展示
print("截图2: 全屏展示...")
screenshot2 = pyautogui.screenshot()
screenshot2.save(str(output_dir / "desktop-view.png"))
print("✅ 保存: desktop-view.png")

print("\n🎉 截图完成！")
print(f"保存位置: {output_dir}")
