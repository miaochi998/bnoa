# BNOA Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** BNOA (Business Network Office Automation)
**Version:** 1.0
**Style:** Minimalist Dark (极简暗黑)
**Technology:** React + shadcn/ui + Tailwind CSS
**Last Updated:** 2026-02-01

---

## 🎨 设计原则 (Design Principles)

### 1. 极简暗黑 (Minimalist Dark)

**核心特征**:
- 暗色背景体系（#1e1e1e → #262626 → #2e2e2e）
- 单一主色调（蓝色 #409fff）
- 无阴影设计（使用1px边框分隔）
- 克制的视觉装饰

### 2. 快速响应 (Fast Response)

**性能优先**:
- 动画时长：200ms（快速反馈）/ 300ms（标准动画）
- 小幅度交互：缩放98%-105%
- 避免复杂动画和阴影
- 使用transform替代position

### 3. 规律一致 (Consistent)

**视觉规律**:
- 8px基础间距单元
- 统一圆角系统（6px / 8px / 12px / 100%）
- 克制字号范围（12px - 32px）
- 有限的颜色和字重选择

---

## 🎨 Design Tokens

### 颜色系统 (Color System)

#### 主色调 (Primary Color)
```css
--primary: 210 100% 62%;           /* #409fff - 唯一装饰彩色 */
--primary-foreground: 0 0% 100%;   /* #ffffff */
```

**使用场景**: 链接、主要按钮、Tab激活、焦点状态、品牌标识

#### 背景色 (Background Colors)
```css
--background: 0 0% 12%;            /* #1e1e1e - L1 页面底色 */
--card: 0 0% 15%;                  /* #262626 - L2 卡片/容器 */
--card-hover: 0 0% 18%;            /* #2e2e2e - L3 悬停状态 */
```

**层级关系**: L1 (最暗) < L2 (中间) < L3 (最浅)

#### 文字色 (Text Colors)
```css
--foreground: 0 0% 100%;           /* #ffffff - 主要文字 */
--muted-foreground: 0 0% 56%;      /* #8e8e8e - 次要文字 */
```

**使用原则**: 主要内容用foreground，辅助信息用muted-foreground

#### 边框色 (Border Colors)
```css
--border: 0 0% 18%;                /* #2e2e2e - 基础边框 */
--input: 0 0% 31%;                 /* #4e4e4e - 输入框边框 */
```

**重要**: 统一使用 `border: 1px solid`，不使用box-shadow

#### 状态色 (State Colors)
```css
--success: 120 100% 36%;           /* #00b800 - 成功状态 */
--warning: 45 100% 51%;            /* #ffa500 - 警告状态 */
--destructive: 0 84% 60%;          /* #ff4444 - 错误/危险 */
--info: 210 100% 62%;              /* #409fff - 信息提示 */
```

**特别说明**: 绿色仅用于成功状态，避免滥用彩色

---

### 间距系统 (Spacing Scale)

基于 **8px** 基础单元的等比间距系统：

```css
--spacing-0: 0px;      /* 0 */
--spacing-1: 8px;      /* 0.5rem - 最小间距 */
--spacing-2: 12px;     /* 0.75rem */
--spacing-3: 16px;     /* 1rem - 标准元素内边距 */
--spacing-4: 24px;     /* 1.5rem - 元素间距 */
--spacing-5: 32px;     /* 2rem - 区块间距 */
--spacing-6: 40px;     /* 2.5rem - 大区块间距 */
--spacing-7: 48px;     /* 3rem */
--spacing-8: 64px;     /* 4rem - 页面级间距 */
--spacing-10: 80px;    /* 5rem */
--spacing-12: 96px;    /* 6rem */
```

**使用指南**:
- 元素内边距（padding）: spacing-3 (16px)
- 小元素间距（gap）: spacing-2 (12px)
- 标准元素间距: spacing-4 (24px)
- 区块间距: spacing-5~6 (32px~40px)
- 页面边距: spacing-6~8 (40px~64px)

---

### 字体系统 (Typography)

#### 字号 (Font Sizes)
```css
--text-xs: 12px;       /* 0.75rem - 辅助文字、标签 */
--text-sm: 14px;       /* 0.875rem - 正文、按钮 */
--text-base: 16px;     /* 1rem - 标准正文 */
--text-lg: 18px;       /* 1.125rem - 强调正文 */
--text-xl: 20px;       /* 1.25rem - 小标题 */
--text-2xl: 24px;      /* 1.5rem - 中标题 */
--text-3xl: 32px;      /* 2rem - 大标题 */
--text-4xl: 40px;      /* 2.5rem - 特大标题 */
```

#### 字重 (Font Weights)
```css
--font-normal: 400;    /* 正文 */
--font-medium: 500;    /* 强调 */
--font-semibold: 600;  /* 标题、按钮 */
```

#### 行高 (Line Heights)
```css
--leading-tight: 1.25;    /* 1.25 - 标题 */
--leading-normal: 1.5;    /* 1.5 - 正文 */
--leading-relaxed: 1.6;   /* 1.6 - 长文本 */
```

**字体层级规范**:
- H1 (页面主标题): 32px / 600 / 1.25
- H2 (区块标题): 24px / 600 / 1.25
- H3 (小节标题): 20px / 600 / 1.25
- Body (正文): 14px / 400 / 1.5
- Caption (辅助文字): 12px / 400 / 1.5

---

### 圆角系统 (Border Radius)

```css
--radius-none: 0px;       /* 无圆角 */
--radius-sm: 6px;         /* 按钮、输入框、Badge */
--radius-md: 8px;         /* 卡片、容器 */
--radius-lg: 12px;        /* Modal、Dialog */
--radius-xl: 16px;        /* 大型容器 */
--radius-full: 9999px;    /* 圆形元素（头像、指示灯） */
```

**使用原则**:
- 小元素（按钮、输入框）: 6px
- 中型元素（卡片）: 8px
- 大型容器（Modal）: 12px
- 圆形元素: 9999px或100%

---

### 动画系统 (Animation)

#### 时长 (Duration)
```css
--duration-fast: 150ms;     /* 快速反馈（微交互） */
--duration-normal: 200ms;   /* 标准动画（悬停、点击） */
--duration-slow: 300ms;     /* 缓慢动画（展开、折叠） */
```

#### 缓动函数 (Easing)
```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);           /* 加速 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);          /* 减速 */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);     /* 平滑 */
--ease-bounce: cubic-bezier(0.16, 1, 0.3, 1);    /* 弹性 */
```

**使用指南**:
- 出现动画: ease-out
- 消失动画: ease-in
- 状态切换: ease-in-out
- 反馈动画: ease-bounce

---

### 阴影系统 (Shadows)

**重要**: 本设计系统**不使用阴影**，改用边框分隔。

```css
/* ❌ 不推荐 */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* ✅ 推荐 */
border: 1px solid var(--border);
```

**原因**: 提升性能，保持极简风格，避免视觉噪音。

---

## 🧩 基础组件规范 (Component Specifications)

### Button (按钮)

#### 尺寸规格
```css
/* 小按钮 */
.button-sm {
  height: 36px;
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 6px;
}

/* 标准按钮 */
.button-md {
  height: 44px;
  padding: 12px 24px;
  font-size: 14px;
  border-radius: 6px;
}

/* 大按钮 */
.button-lg {
  height: 50px;
  padding: 14px 32px;
  font-size: 16px;
  border-radius: 6px;
}
```

#### 变体 (Variants)

**主要按钮 (Primary)**:
```tsx
<Button className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]">
  主要操作
</Button>
```

**次要按钮 (Secondary)**:
```tsx
<Button variant="outline" className="border-input bg-transparent hover:bg-card-hover">
  次要操作
</Button>
```

**成功按钮 (Success)**:
```tsx
<Button className="bg-success text-white hover:bg-success/90">
  确认操作
</Button>
```

**危险按钮 (Destructive)**:
```tsx
<Button className="bg-destructive text-white hover:bg-destructive/90">
  删除操作
</Button>
```

**幽灵按钮 (Ghost)**:
```tsx
<Button variant="ghost" className="bg-transparent hover:bg-card-hover">
  幽灵按钮
</Button>
```

#### 状态规范
- **悬停**: 背景色变暗10% (`/90`)
- **点击**: 缩小到98% (`scale(0.98)`)
- **禁用**: 透明度50% + 禁止交互
- **加载**: 显示loading图标 + 禁止交互

---

### Input (输入框)

#### 基础规格
```css
.input {
  height: 44px;
  padding: 12px 16px;
  border: 1px solid var(--input);
  border-radius: 6px;
  background: var(--card);
  color: var(--foreground);
  font-size: 14px;
}

.input:focus {
  border-color: var(--primary);
  outline: none;
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 尺寸变体
```css
.input-sm { height: 36px; padding: 8px 12px; font-size: 14px; }
.input-md { height: 44px; padding: 12px 16px; font-size: 14px; }
.input-lg { height: 50px; padding: 14px 20px; font-size: 16px; }
```

#### 带图标输入框
```tsx
<div className="relative">
  <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <Input className="pl-12" />
</div>
```

**图标规范**:
- 位置: 左侧16px (left-4)
- 尺寸: 16px × 16px (w-4 h-4)
- 颜色: muted-foreground
- 输入框左内边距: 48px (pl-12)

---

### Card (卡片)

#### 基础规格
```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
}

.card:hover {
  background: var(--card-hover);
  border-color: var(--input);
}
```

#### 内边距变体
```css
.card-compact { padding: 16px; }    /* 紧凑 */
.card-default { padding: 24px; }    /* 标准 */
.card-relaxed { padding: 32px; }    /* 宽松 */
```

#### 交互变体
```tsx
/* 可点击卡片 */
<Card className="cursor-pointer hover:border-primary/50 transition-colors">

/* 可选中卡片 */
<Card className="data-[selected=true]:border-primary data-[selected=true]:bg-primary/5">
```

---

### Badge (标签)

#### 基础规格
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
}
```

#### 变体
```tsx
/* 默认 */
<Badge className="bg-muted text-muted-foreground">默认</Badge>

/* 主要 */
<Badge className="bg-primary text-primary-foreground">主要</Badge>

/* 成功 */
<Badge className="bg-success text-white">成功</Badge>

/* 警告 */
<Badge className="bg-warning text-white">警告</Badge>

/* 错误 */
<Badge className="bg-destructive text-white">错误</Badge>

/* 轮廓 */
<Badge variant="outline" className="border-border">轮廓</Badge>
```

---

### Avatar (头像)

#### 尺寸规格
```css
.avatar-xs { width: 24px; height: 24px; }   /* 极小 */
.avatar-sm { width: 32px; height: 32px; }   /* 小 */
.avatar-md { width: 40px; height: 40px; }   /* 中（默认） */
.avatar-lg { width: 64px; height: 64px; }   /* 大 */
.avatar-xl { width: 96px; height: 96px; }   /* 极大 */
.avatar-2xl { width: 120px; height: 120px; } /* 超大 */
```

#### 基础样式
```tsx
<Avatar className="rounded-full border-2 border-card">
  <AvatarImage src="avatar.jpg" />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

#### 带状态指示器
```tsx
<div className="relative">
  <Avatar className="w-10 h-10" />
  <span className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-background rounded-full" />
</div>
```

**状态指示器规范**:
- 尺寸: 头像的30%（如40px头像用12px指示器）
- 位置: 右下角
- 边框: 2px solid background
- 颜色: success(在线) / muted(离线) / warning(忙碌) / destructive(勿扰)

---

### Tabs (标签页)

#### 基础样式
```tsx
<Tabs>
  <TabsList className="bg-transparent border-b border-border">
    <TabsTrigger 
      className="
        pb-3 px-4
        text-muted-foreground
        border-b-2 border-transparent
        data-[state=active]:text-foreground
        data-[state=active]:border-primary
        hover:text-foreground
        transition-colors
      "
    >
      标签1
    </TabsTrigger>
  </TabsList>
</Tabs>
```

**规范**:
- 字号: 16px / 500
- 内边距: 12px 16px (py-3 px-4)
- 未激活: text-muted-foreground
- 激活: text-foreground + 2px蓝色底部边框
- 悬停: text-foreground

---

### Dialog / Modal (对话框)

#### 尺寸规格
```css
.dialog-sm { max-width: 320px; }   /* 小 */
.dialog-md { max-width: 440px; }   /* 中（默认） */
.dialog-lg { max-width: 640px; }   /* 大 */
.dialog-xl { max-width: 800px; }   /* 极大 */
.dialog-full { max-width: 95vw; }  /* 全屏 */
```

#### 基础样式
```tsx
<Dialog>
  <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
  <DialogContent className="bg-card border-border rounded-xl p-8">
    <DialogHeader>
      <DialogTitle className="text-2xl font-semibold">标题</DialogTitle>
    </DialogHeader>
    <DialogBody className="py-6">内容</DialogBody>
    <DialogFooter className="flex gap-3 justify-end">
      <Button variant="outline">取消</Button>
      <Button>确认</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**规范**:
- 遮罩: 黑色70%透明度 + 毛玻璃效果
- 圆角: 12px
- 内边距: 32px
- z-index: 50

---

### Tooltip (提示框)

```tsx
<Tooltip>
  <TooltipTrigger>触发元素</TooltipTrigger>
  <TooltipContent className="bg-foreground text-background px-3 py-2 text-sm rounded-md">
    提示内容
  </TooltipContent>
</Tooltip>
```

**规范**:
- 背景: foreground (反色)
- 文字: background (反色)
- 字号: 12px
- 圆角: 6px
- 内边距: 8px 12px
- 最大宽度: 240px

---

## 📐 布局系统 (Layout System)

### Container (容器)

#### 页面容器
```css
.page-container {
  max-width: 1440px;      /* 最大宽度 */
  margin: 0 auto;         /* 居中 */
  padding: 0 40px;        /* 左右边距 */
}

/* 响应式 */
@media (max-width: 1024px) {
  .page-container { padding: 0 24px; }
}
@media (max-width: 640px) {
  .page-container { padding: 0 16px; }
}
```

#### 内容容器
```css
.content-container {
  max-width: 720px;       /* 阅读宽度 */
  margin: 0 auto;
}

.content-wide {
  max-width: 960px;       /* 宽内容 */
}

.content-full {
  max-width: 100%;        /* 全宽 */
}
```

---

### Grid 系统

#### 基础Grid
```css
.grid {
  display: grid;
  gap: 32px;
}

/* 列数变体 */
.grid-1 { grid-template-columns: repeat(1, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-6 { grid-template-columns: repeat(6, 1fr); }
.grid-12 { grid-template-columns: repeat(12, 1fr); }
```

#### 响应式Grid
```css
.grid-responsive {
  display: grid;
  gap: 32px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
```

#### 间距变体
```css
.grid-gap-sm { gap: 16px; }    /* 小间距 */
.grid-gap-md { gap: 24px; }    /* 中间距 */
.grid-gap-lg { gap: 32px; }    /* 大间距（默认） */
.grid-gap-xl { gap: 40px; }    /* 极大间距 */
```

---

### Flex 系统

```css
/* 基础Flex */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }

/* 对齐 */
.items-start { align-items: flex-start; }
.items-center { align-items: center; }
.items-end { align-items: flex-end; }
.items-stretch { align-items: stretch; }

.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }

/* 间距 */
.gap-1 { gap: 8px; }
.gap-2 { gap: 12px; }
.gap-3 { gap: 16px; }
.gap-4 { gap: 24px; }
.gap-5 { gap: 32px; }
```

---

### 通用布局模式

#### 侧边栏布局 (Admin Layout)
```tsx
<div className="flex min-h-screen">
  <aside className="w-64 border-r border-border bg-card">
    侧边栏导航
  </aside>
  <main className="flex-1 bg-background">
    内容区域
  </main>
</div>
```

#### 单栏居中布局
```tsx
<div className="flex flex-col items-center max-w-2xl mx-auto px-6">
  <h1>标题</h1>
  <p>内容</p>
</div>
```

#### 两栏布局（主次）
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
  <main>主要内容</main>
  <aside>次要内容</aside>
</div>
```

#### 三栏布局（等宽）
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <div>栏1</div>
  <div>栏2</div>
  <div>栏3</div>
</div>
```

---

### 响应式断点

```css
/* Tailwind默认断点 */
sm: 640px    /* 手机横屏、小平板 */
md: 768px    /* 平板竖屏 */
lg: 1024px   /* 平板横屏、小笔记本 */
xl: 1280px   /* 笔记本 */
2xl: 1536px  /* 大屏显示器 */
```

**使用指南**:
- 移动优先: 默认样式为移动端，逐步添加大屏样式
- 断点选择: 根据内容决定，不要强制在固定断点切换
- 测试: 确保在所有断点间的过渡尺寸也能正常显示

---

## 🎭 交互规范 (Interaction Patterns)

### 悬停状态 (Hover States)

```css
/* 按钮 */
.button:hover {
  background-color: hsl(var(--primary) / 0.9);
}

/* 卡片 */
.card:hover {
  background-color: hsl(var(--card-hover));
  border-color: hsl(var(--input));
}

/* 链接 */
a:hover {
  text-decoration: underline;
  color: hsl(var(--primary));
}

/* 图标 */
.icon:hover {
  transform: scale(1.05);
}
```

**原则**: 小幅度变化（5%-10%），200ms过渡

---

### 焦点状态 (Focus States)

```css
/* 输入框 */
.input:focus {
  border-color: hsl(var(--primary));
  outline: none;
}

/* 按钮 */
.button:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

/* 链接 */
a:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 4px;
  border-radius: 2px;
}
```

**原则**: 使用outline而非border，提供清晰的可访问性指示

---

### 点击反馈 (Active States)

```css
/* 按钮 */
.button:active {
  transform: scale(0.98);
}

/* 图标按钮 */
.icon-button:active {
  transform: scale(0.95);
}

/* 卡片 */
.card:active {
  transform: translateY(1px);
}
```

**原则**: 微小缩放或位移，提供触觉反馈

---

### 禁用状态 (Disabled States)

```css
.disabled,
[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

### 加载状态 (Loading States)

```tsx
<Button disabled className="opacity-50 cursor-wait">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  加载中...
</Button>
```

**规范**:
- 显示loading图标（16px旋转动画）
- 禁用交互（disabled）
- 透明度50%
- 鼠标样式: wait或progress

---

### 空状态 (Empty States)

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="mb-4 text-muted-foreground">
    <FileX className="w-16 h-16" />
  </div>
  <h3 className="text-xl font-semibold mb-2">暂无内容</h3>
  <p className="text-sm text-muted-foreground mb-6">
    这里还没有任何内容
  </p>
  <Button>创建内容</Button>
</div>
```

**规范**:
- 居中对齐
- 灰色图标（64px）
- 标题 + 描述 + 操作按钮
- 垂直间距: 16px / 24px

---

### 错误状态 (Error States)

```tsx
<div className="border-l-4 border-destructive bg-destructive/10 p-4 rounded">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
    <div>
      <h4 className="font-semibold text-destructive mb-1">错误</h4>
      <p className="text-sm">操作失败，请重试</p>
    </div>
  </div>
</div>
```

---

## 🛠️ shadcn/ui 配置

### globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 12%;
    --foreground: 0 0% 100%;
    --card: 0 0% 15%;
    --card-foreground: 0 0% 100%;
    --primary: 210 100% 62%;
    --primary-foreground: 0 0% 100%;
    --muted: 0 0% 18%;
    --muted-foreground: 0 0% 56%;
    --border: 0 0% 18%;
    --input: 0 0% 31%;
    --ring: 210 100% 62%;
    --success: 120 100% 36%;
    --warning: 45 100% 51%;
    --destructive: 0 84% 60%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

---

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: "hsl(var(--destructive))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

---

## ❌ Anti-Patterns (禁止项)

### 图标与视觉元素

| 规则 | Do | Don't |
|------|----|----- |
| **No emoji icons** | 使用 SVG 图标 (Heroicons, Lucide) | 使用表情符号如 🎨 🚀 ⚙️ 作为 UI 图标 |
| **Stable hover states** | 使用颜色/透明度过渡 | 使用会导致布局偏移的缩放变换 |
| **Correct brand logos** | 从 Simple Icons 获取官方 SVG | 猜测或使用错误的 logo 路径 |
| **Consistent icon sizing** | 使用固定 viewBox (24x24) 配合 w-6 h-6 | 随机混合不同图标尺寸 |

### 交互与光标

| 规则 | Do | Don't |
|------|----|----- |
| **Cursor pointer** | 为所有可点击/悬停卡片添加 `cursor-pointer` | 在交互元素上使用默认光标 |
| **Hover feedback** | 提供视觉反馈（颜色、边框） | 没有指示元素是可交互的 |
| **Smooth transitions** | 使用 `transition-colors duration-200` | 瞬时状态变化或过慢 (>500ms) |

### 对比度

| 规则 | Do | Don't |
|------|----|----- |
| **Text contrast** | 主要文字使用 #ffffff，次要使用 #8e8e8e | 使用过浅的文字颜色 |
| **Border visibility** | 使用 `border-border` (hsl(0 0% 18%)) | 使用不可见的边框颜色 |

### 布局与间距

| 规则 | Do | Don't |
|------|----|----- |
| **Content padding** | 考虑固定导航栏高度 | 让内容隐藏在固定元素后面 |
| **Consistent max-width** | 使用相同的 `max-w-6xl` 或 `max-w-7xl` | 混合不同的容器宽度 |

---

## ✅ Pre-Delivery Checklist

交付 UI 代码前，验证以下项目：

### 视觉质量
- [ ] 不使用表情符号作为图标（使用 SVG 替代）
- [ ] 所有图标来自一致的图标集 (Heroicons/Lucide)
- [ ] 品牌 logo 正确（从 Simple Icons 验证）
- [ ] 悬停状态不会导致布局偏移
- [ ] 直接使用主题颜色（bg-primary）而非 var() 包装

### 交互
- [ ] 所有可点击元素都有 `cursor-pointer`
- [ ] 悬停状态提供清晰的视觉反馈
- [ ] 过渡平滑（150-300ms）
- [ ] 焦点状态对键盘导航可见

### 对比度
- [ ] 文字对比度足够（主要文字 #ffffff，次要 #8e8e8e）
- [ ] 边框在所有状态下可见
- [ ] 交付前测试暗色模式

### 布局
- [ ] 浮动元素与边缘有适当间距
- [ ] 没有内容隐藏在固定导航栏后面
- [ ] 响应式：375px、768px、1024px、1440px
- [ ] 移动端没有水平滚动

### 可访问性
- [ ] 所有图片都有 alt 文本
- [ ] 表单输入框有标签
- [ ] 颜色不是唯一的指示器
- [ ] 尊重 `prefers-reduced-motion`

---

## 🔗 相关文档

- `docs/前端/设计系统规范-v2.1-FINAL.md` - 原始设计系统规范
- `docs/草图/页面规划及草图.md` - 页面规划及草图
- `.trae/skills/ui-ux-pro-max/SKILL.md` - UI UX Pro Max 使用指南

---

**🎯 本文档是 BNOA 项目的设计系统基础规范，所有前端开发必须严格遵守！**
