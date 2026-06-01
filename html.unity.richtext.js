/**
 * HURichTextEditor - Unity 富文本可视化编辑器
 * 支持全部 35 个 Unity 富文本标签，提供可视化操作控件。
 * 单文件、零依赖、原生 JS 实现。
 *
 * 用法：
 *   // 默认（高级模式）— 全部 35 个标签
 *   new HURichTextEditor('#myTextarea', '#previewContainer');
 *
 *   // 基础模式 — 6 个基础标签（b, i, u, s, color, size）
 *   new HURichTextEditor('#myTextarea', '#previewContainer', { mode: 'base' });
 *
 *   // 高级模式 — 显式声明，全部 35 个标签
 *   new HURichTextEditor('#myTextarea', '#previewContainer', { mode: 'advance' });
 *
 *   // 自定义模式 — 用户自选标签
 *   new HURichTextEditor('#myTextarea', '#previewContainer', {
 *       mode: 'custom',
 *       tags: ['b', 'i', 'u', 'color', 'size', 'align', 'mark']
 *   });
 */
class HURichTextEditor {

    // ─────────────────────────────────────────────────────────────
    //  模式定义
    // ─────────────────────────────────────────────────────────────
    static MODES = {
        base: {
            groups: [
                { label: '格式', tags: ['b', 'i', 'u', 's'] },
                { label: '样式',  tags: ['color', 'size'] }
            ]
        },
        advance: null  // null = all tags from _buildTagConfig()
    };

    // ─────────────────────────────────────────────────────────────
    //  构造函数
    // ─────────────────────────────────────────────────────────────
    constructor(selector, previewSelector, options = null) {
        this.textarea = document.querySelector(selector);
        if (!this.textarea) throw new Error('textarea not found');

        this.preview = document.querySelector(previewSelector) || this._createPreviewElement();
        this.preview.className = 'rich-text-preview';

        this._activePopup = null;
        this._popupAnchor = null;
        this._onDocClickBound = (e) => this._onDocumentClick(e);

        // 构建完整标签注册表（始终包含全部 35 个标签）
        this.TAG_CONFIG = this._buildTagConfig();

        // 解析模式并确定工具栏分组
        const resolved = this._resolveMode(options);
        this._activeGroups = resolved.groups;
        this._activeTags = resolved.tags;

        // 如果提供了标签覆盖配置，则应用
        if (resolved.overrides) {
            for (const key in resolved.overrides) {
                if (Object.prototype.hasOwnProperty.call(resolved.overrides, key)) {
                    this.TAG_CONFIG[key] = { ...this.TAG_CONFIG[key], ...resolved.overrides[key] };
                }
            }
        }

        // 构建 UI
        this.toolbar = this._createToolbar();
        this._renderToolbar();
        this._createPopupContainer();
        this._bindEvents();

        // 渲染初始预览内容
        this.updateOutput();
    }

    // ─────────────────────────────────────────────────────────────
    //  清理 / 销毁
    // ─────────────────────────────────────────────────────────────

    /**
     * 移除本编辑器实例创建的所有事件监听器、DOM 元素和注入的样式。
     * 在从页面移除编辑器之前调用此方法，以避免内存泄漏。
     */
    destroy() {
        // 清除待执行的防抖定时器
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        // 移除 textarea 上的事件监听器
        if (this._onInput) {
            this.textarea.removeEventListener('input', this._onInput);
        }
        if (this._onKeydown) {
            this.textarea.removeEventListener('keydown', this._onKeydown);
        }

        // 关闭并移除弹窗
        this._hidePopup();
        if (this._popup && this._popup.parentNode) {
            this._popup.parentNode.removeChild(this._popup);
        }
        this._popup = null;

        // 移除工具栏
        if (this.toolbar && this.toolbar.parentNode) {
            this.toolbar.parentNode.removeChild(this.toolbar);
        }
        this.toolbar = null;

        // 移除注入的样式
        const styleEl = document.getElementById('hurichtext-styles');
        if (styleEl) styleEl.remove();

        // 移除预览区域的 class（但不移除元素本身 — 用户可能自行管理）
        if (this.preview) {
            this.preview.classList.remove('rich-text-preview');
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  模式解析
    // ─────────────────────────────────────────────────────────────

    /**
     * 解析 options 参数并确定当前工作模式。
     *
     * 自动判断 `options` 的类型：
     *   - 模式配置对象（包含 `mode` 或 `tags` 键）
     *   - 旧版标签覆盖对象（键为标签名）
     *
     * 返回：{ groups: [], tags: [], overrides: {}|null }
     */
    _resolveMode(options) {
        // 高级模式全部分组（完整的工具栏布局）
        const allGroups = [
            { label: '格式',     tags: ['b', 'i', 'u', 's'] },
            { label: '文本变换', tags: ['allcaps', 'lowercase', 'uppercase', 'smallcaps', 'sub', 'sup'] },
            { label: '字体',     tags: ['font', 'font-weight', 'size'] },
            { label: '布局',     tags: ['align', 'cspace', 'mspace', 'indent', 'line-height', 'line-indent', 'margin', 'voffset', 'width'] },
            { label: '颜色与效果', tags: ['color', 'alpha', 'mark', 'gradient', 'style'] },
            { label: '链接',     tags: ['a', 'link', 'sprite'] },
            { label: '插入',     tags: ['br', 'space', 'pos', 'nobr', 'noparse'] },
        ];

        // 无参数 → 高级模式（默认，全部标签）
        if (!options) {
            const tags = allGroups.flatMap(g => g.tags);
            return { groups: allGroups, tags, overrides: null };
        }

        // 旧版向后兼容：纯标签覆盖对象（无 `mode`/`tags` 键）
        const isModeConfig = options.mode !== undefined || options.tags !== undefined;
        if (!isModeConfig) {
            const tags = allGroups.flatMap(g => g.tags);
            return { groups: allGroups, tags, overrides: options };
        }

        const mode = options.mode || 'advance';

        // ── 基础模式 ──
        if (mode === 'base') {
            const baseDef = HURichTextEditor.MODES.base;
            const tags = baseDef.groups.flatMap(g => g.tags);
            return { groups: baseDef.groups, tags, overrides: options.tagOverrides || null };
        }

        // ── 高级模式 ──
        if (mode === 'advance') {
            const tags = allGroups.flatMap(g => g.tags);
            return { groups: allGroups, tags, overrides: options.tagOverrides || null };
        }

        // ── 自定义模式 ──
        if (mode === 'custom') {
            const userTags = options.tags || [];
            if (!Array.isArray(userTags) || userTags.length === 0) {
                console.warn('HURichTextEditor: custom mode requires a non-empty `tags` array. Falling back to advance mode.');
                const tags = allGroups.flatMap(g => g.tags);
                return { groups: allGroups, tags, overrides: options.tagOverrides || null };
            }

            // 过滤 allGroups，仅包含选中的标签，跳过空分组
            const customGroups = allGroups
                .map(g => ({
                    label: g.label,
                    tags: g.tags.filter(t => userTags.includes(t))
                }))
                .filter(g => g.tags.length > 0);

            return { groups: customGroups, tags: userTags, overrides: options.tagOverrides || null };
        }

        // 未知模式 → 回退到高级模式
        console.warn(`HURichTextEditor: unknown mode "${mode}". Falling back to advance mode.`);
        const tags = allGroups.flatMap(g => g.tags);
        return { groups: allGroups, tags, overrides: options.tagOverrides || null };
    }

    // ─────────────────────────────────────────────────────────────
    //  标签注册表 — 全部 35 个 Unity 富文本标签
    // ─────────────────────────────────────────────────────────────
    _buildTagConfig() {
        return {
            // ── 基础格式（切换型，无参数值）──
            b: {
                name: 'b', type: 'toggle', category: 'basic',
                open: '<b>', close: '</b>',
                control: 'none', icon: 'B', label: '加粗',
                iconStyle: 'font-weight:bold'
            },
            i: {
                name: 'i', type: 'toggle', category: 'basic',
                open: '<i>', close: '</i>',
                control: 'none', icon: 'I', label: '斜体',
                iconStyle: 'font-style:italic'
            },
            u: {
                name: 'u', type: 'toggle', category: 'basic',
                open: '<u>', close: '</u>',
                control: 'none', icon: 'U', label: '下划线',
                iconStyle: 'text-decoration:underline'
            },
            s: {
                name: 's', type: 'toggle', category: 'basic',
                open: '<s>', close: '</s>',
                control: 'none', icon: 'S', label: '删除线',
                iconStyle: 'text-decoration:line-through'
            },

            // ── 文本变换（切换型，无参数值）──
            allcaps: {
                name: 'allcaps', type: 'toggle', category: 'text-transform',
                open: '<allcaps>', close: '</allcaps>',
                control: 'none', icon: 'AA', label: '全部大写',
                iconStyle: 'font-weight:bold;font-size:11px;letter-spacing:-1px'
            },
            lowercase: {
                name: 'lowercase', type: 'toggle', category: 'text-transform',
                open: '<lowercase>', close: '</lowercase>',
                control: 'none', icon: 'aa', label: '全部小写',
                iconStyle: 'font-size:11px;letter-spacing:-1px'
            },
            uppercase: {
                name: 'uppercase', type: 'toggle', category: 'text-transform',
                open: '<uppercase>', close: '</uppercase>',
                control: 'none', icon: 'A<small>B</small>', label: '转大写',
                iconStyle: 'font-weight:bold;font-size:11px'
            },
            smallcaps: {
                name: 'smallcaps', type: 'toggle', category: 'text-transform',
                open: '<smallcaps>', close: '</smallcaps>',
                control: 'none', icon: 'Aa', label: '小型大写',
                iconStyle: 'font-variant:small-caps;font-weight:bold;font-size:12px'
            },
            sub: {
                name: 'sub', type: 'toggle', category: 'text-transform',
                open: '<sub>', close: '</sub>',
                control: 'none', icon: 'X<sub>2</sub>', label: '下标',
                iconStyle: 'font-size:13px'
            },
            sup: {
                name: 'sup', type: 'toggle', category: 'text-transform',
                open: '<sup>', close: '</sup>',
                control: 'none', icon: 'X<sup>2</sup>', label: '上标',
                iconStyle: 'font-size:13px'
            },

            // ── 字体与字号 ──
            font: {
                name: 'font', type: 'value', category: 'font',
                open: (v) => `<font="${v}">`, close: '</font>',
                control: 'text', icon: 'F', label: '字体',
                iconStyle: 'font-family:Georgia,serif;font-weight:bold;font-size:14px',
                controlOptions: {
                    placeholder: '例如：Impact SDF, Arial SDF',
                },
                validator: (v) => v && v.trim().length > 0
            },
            'font-weight': {
                name: 'font-weight', type: 'value', category: 'font',
                open: (v) => `<font-weight="${v}">`, close: '</font-weight>',
                control: 'dropdown', icon: 'W', label: '字重',
                iconStyle: 'font-weight:900;font-size:13px',
                controlOptions: {
                    choices: [
                        { value: '100', label: '100 — 极细' },
                        { value: '200', label: '200 — 特细' },
                        { value: '300', label: '300 — 细体' },
                        { value: '400', label: '400 — 常规' },
                        { value: '500', label: '500 — 中等' },
                        { value: '600', label: '600 — 半粗' },
                        { value: '700', label: '700 — 粗体' },
                        { value: '800', label: '800 — 特粗' },
                        { value: '900', label: '900 — 黑体' },
                    ],
                    default: '700'
                }
            },
            size: {
                name: 'size', type: 'value', category: 'font',
                open: (v) => `<size=${v}>`, close: '</size>',
                control: 'number-unit', icon: 'A', label: '字号',
                iconStyle: 'font-size:16px;font-weight:bold',
                controlOptions: {
                    units: ['px', '%', 'em'],
                    defaultUnit: 'px', default: 24,
                    min: 1, max: 300, step: 1
                },
                validator: (v) => /^\d+(\.\d+)?(px|%|em)?$/.test(v)
            },

            // ── 间距与布局 ──
            cspace: {
                name: 'cspace', type: 'value', category: 'spacing',
                open: (v) => `<cspace=${v}>`, close: '</cspace>',
                control: 'number-unit', icon: '↔', label: '字间距',
                iconStyle: 'font-size:14px;letter-spacing:2px',
                controlOptions: {
                    units: ['px', 'em'],
                    defaultUnit: 'em', default: 0.1,
                    min: -10, max: 10, step: 0.05
                }
            },
            mspace: {
                name: 'mspace', type: 'value', category: 'spacing',
                open: (v) => `<mspace=${v}>`, close: '</mspace>',
                control: 'number-unit', icon: 'M', label: '等宽宽度',
                iconStyle: 'font-family:monospace;font-size:13px;font-weight:bold',
                controlOptions: {
                    units: ['em'],
                    defaultUnit: 'em', default: 2.75,
                    min: 0.5, max: 10, step: 0.05
                }
            },
            indent: {
                name: 'indent', type: 'value', category: 'spacing',
                open: (v) => `<indent=${v}>`, close: '</indent>',
                control: 'number-unit', icon: '⇥', label: '缩进',
                iconStyle: 'font-size:15px',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: '%', default: 15,
                    min: 0, max: 100, step: 1
                }
            },
            'line-height': {
                name: 'line-height', type: 'value', category: 'spacing',
                open: (v) => `<line-height=${v}>`, close: '</line-height>',
                control: 'number-unit', icon: '↕', label: '行高',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: '%', default: 100,
                    min: 10, max: 300, step: 5
                }
            },
            'line-indent': {
                name: 'line-indent', type: 'value', category: 'spacing',
                open: (v) => `<line-indent=${v}>`, close: '</line-indent>',
                control: 'number-unit', icon: '↦', label: '首行缩进',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: '%', default: 15,
                    min: 0, max: 100, step: 1
                }
            },
            margin: {
                name: 'margin', type: 'value', category: 'spacing',
                open: (v) => `<margin=${v}>`, close: '</margin>',
                control: 'number-unit', icon: '⟺', label: '外边距',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: 'em', default: 5,
                    min: 0, max: 100, step: 0.5
                }
            },
            voffset: {
                name: 'voffset', type: 'value', category: 'spacing',
                open: (v) => `<voffset=${v}>`, close: '</voffset>',
                control: 'number-unit', icon: '⇕', label: '垂直偏移',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em'],
                    defaultUnit: 'em', default: 0.5,
                    min: -50, max: 50, step: 0.1
                }
            },
            width: {
                name: 'width', type: 'value', category: 'spacing',
                open: (v) => `<width=${v}>`, close: '</width>',
                control: 'number-unit', icon: '⬌', label: '宽度',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: '%', default: 60,
                    min: 1, max: 100, step: 1
                }
            },
            align: {
                name: 'align', type: 'value', category: 'spacing',
                open: (v) => `<align="${v}">`, close: '</align>',
                control: 'dropdown', icon: '☰', label: '对齐方式',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    choices: [
                        { value: 'left', label: '左对齐' },
                        { value: 'center', label: '居中' },
                        { value: 'right', label: '右对齐' },
                        { value: 'justified', label: '两端对齐' },
                        { value: 'flush', label: '填满' },
                    ],
                    default: 'center'
                }
            },

            // ── 颜色与效果 ──
            color: {
                name: 'color', type: 'value', category: 'color',
                open: (v) => `<color=${v}>`, close: '</color>',
                control: 'color', icon: '🎨', label: '文字颜色',
                iconStyle: 'font-size:14px',
                controlOptions: { default: '#FF0000' },
                validator: (v) => /^(#[0-9A-Fa-f]{6}|[a-zA-Z]+)$/.test(v)
            },
            alpha: {
                name: 'alpha', type: 'value', category: 'color',
                open: (v) => `<alpha=#${v}>`, close: '</alpha>',
                control: 'alpha', icon: 'α', label: '透明度',
                iconStyle: 'font-size:15px;font-style:italic;font-weight:bold',
                controlOptions: { default: 255, min: 0, max: 255 }
            },
            mark: {
                name: 'mark', type: 'value', category: 'color',
                open: (v) => `<mark=${v}>`, close: '</mark>',
                control: 'mark', icon: '🖍', label: '高亮标记',
                iconStyle: 'font-size:14px',
                controlOptions: { defaultColor: '#FFFF00', defaultAlpha: 170 }
            },
            gradient: {
                name: 'gradient', type: 'value', category: 'color',
                open: (v) => `<gradient="${v}">`, close: '</gradient>',
                control: 'text', icon: '▧', label: '渐变',
                iconStyle: 'font-size:15px;background:linear-gradient(90deg,#4f4,#4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent',
                controlOptions: {
                    placeholder: '例如：Light to Dark Green',
                },
                validator: (v) => v && v.trim().length > 0
            },
            style: {
                name: 'style', type: 'value', category: 'color',
                open: (v) => `<style="${v}">`, close: '</style>',
                control: 'text', icon: '✦', label: '样式类',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    placeholder: '例如：H1, H2, Caption',
                },
                validator: (v) => v && v.trim().length > 0
            },

            // ── 链接与媒体 ──
            a: {
                name: 'a', type: 'value', category: 'links',
                open: (v) => `<a href="${v}">`, close: '</a>',
                control: 'text', icon: '🌐', label: '网页链接',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    placeholder: 'https://example.com',
                },
                validator: (v) => /^https?:\/\/.+/i.test(v)
            },
            link: {
                name: 'link', type: 'value', category: 'links',
                open: (v) => `<link="${v}">`, close: '</link>',
                control: 'text', icon: '🔗', label: '链接 ID',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    placeholder: '链接标识符（最多 256 个字符）',
                },
                validator: (v) => v && v.trim().length > 0 && v.length <= 256
            },
            sprite: {
                name: 'sprite', type: 'self-closing', category: 'links',
                open: (v) => `<sprite name="${v}">`, close: '',
                control: 'text', icon: '🖼', label: '精灵',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    placeholder: '精灵资源名称',
                },
                validator: (v) => v && v.trim().length > 0
            },

            // ── 特殊 / 独立标签 ──
            br: {
                name: 'br', type: 'self-closing', category: 'special',
                open: '<br>', close: '',
                control: 'none', icon: '↵', label: '换行',
                iconStyle: 'font-size:15px'
            },
            space: {
                name: 'space', type: 'self-closing', category: 'special',
                open: (v) => `<space=${v}>`, close: '',
                control: 'number-unit', icon: '⎵', label: '水平间距',
                iconStyle: 'font-size:14px',
                controlOptions: {
                    units: ['px', 'em'],
                    defaultUnit: 'em', default: 5,
                    min: 0, max: 50, step: 0.5
                }
            },
            pos: {
                name: 'pos', type: 'self-closing', category: 'special',
                open: (v) => `<pos=${v}>`, close: '',
                control: 'number-unit', icon: '|→', label: '光标位置',
                iconStyle: 'font-size:11px;font-weight:bold',
                controlOptions: {
                    units: ['px', 'em', '%'],
                    defaultUnit: '%', default: 75,
                    min: 0, max: 100, step: 1
                }
            },
            nobr: {
                name: 'nobr', type: 'toggle', category: 'special',
                open: '<nobr>', close: '</nobr>',
                control: 'none', icon: '↮', label: '禁止换行',
                iconStyle: 'font-size:14px'
            },
            noparse: {
                name: 'noparse', type: 'toggle', category: 'special',
                open: '<noparse>', close: '</noparse>',
                control: 'none', icon: '&lt;/&gt;', label: '禁用富文本',
                iconStyle: 'font-size:10px;font-family:monospace'
            },
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  元素创建
    // ─────────────────────────────────────────────────────────────
    _createPreviewElement() {
        const preview = document.createElement('div');
        preview.className = 'rich-text-preview';
        this.textarea.parentNode.insertBefore(preview, this.textarea.nextSibling);
        return preview;
    }

    _createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'rich-text-toolbar';
        this.textarea.parentNode.insertBefore(toolbar, this.textarea);
        this._injectStyles();
        return toolbar;
    }

    _createPopupContainer() {
        this._popup = document.createElement('div');
        this._popup.className = 'rt-popup';
        this._popup.style.display = 'none';
        document.body.appendChild(this._popup);
    }

    // ─────────────────────────────────────────────────────────────
    //  工具栏渲染
    // ─────────────────────────────────────────────────────────────
    _renderToolbar() {
        const groups = this._activeGroups;

        groups.forEach((group, gi) => {
            if (gi > 0) {
                const sep = document.createElement('div');
                sep.className = 'rt-separator';
                this.toolbar.appendChild(sep);
            }

            // 分组标签
            const lbl = document.createElement('span');
            lbl.className = 'rt-group-label';
            lbl.textContent = group.label;
            this.toolbar.appendChild(lbl);

            group.tags.forEach(tagName => {
                const cfg = this.TAG_CONFIG[tagName];
                if (!cfg) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rt-btn';
                btn.title = `<${cfg.name}> — ${cfg.label}`;
                btn.setAttribute('aria-label', cfg.label);
                // 打开弹窗的按钮设置 aria-expanded
                if (cfg.control !== 'none') {
                    btn.setAttribute('aria-expanded', 'false');
                }
                if (cfg.iconStyle) {
                    // 使用 span 包裹图标，以便安全地应用内联样式
                    const iconSpan = document.createElement('span');
                    iconSpan.setAttribute('style', cfg.iconStyle);
                    iconSpan.innerHTML = cfg.icon; // icons are developer-controlled, not user input
                    btn.appendChild(iconSpan);
                } else {
                    btn.textContent = cfg.icon;
                }

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._onToolbarButtonClick(btn, cfg);
                });
                this.toolbar.appendChild(btn);
            });
        });

        // 清除所有格式按钮（危险操作）
        const sep2 = document.createElement('div');
        sep2.className = 'rt-separator';
        this.toolbar.appendChild(sep2);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'rt-btn rt-btn-danger';
        clearBtn.title = '清除所有格式 — 移除全部富文本标签';
        clearBtn.setAttribute('aria-label', '清除所有格式');
        clearBtn.textContent = '🗑';
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.clearAllFormat();
        });
        this.toolbar.appendChild(clearBtn);
    }

    // ─────────────────────────────────────────────────────────────
    //  工具栏按钮点击处理
    // ─────────────────────────────────────────────────────────────
    _onToolbarButtonClick(btn, cfg) {
        // 切换型标签：立即应用，无弹窗
        if (cfg.type === 'toggle') {
            this._applyToggle(cfg);
            return;
        }

        // 自闭合且无控件：立即插入（如 <br>）
        if (cfg.type === 'self-closing' && cfg.control === 'none') {
            this._insertAtCursor(typeof cfg.open === 'function' ? cfg.open() : cfg.open);
            this.updateOutput();
            return;
        }

        // 值型标签和带值的自闭合标签：显示弹窗
        this._showPopup(btn, cfg);
    }

    // ─────────────────────────────────────────────────────────────
    //  弹窗系统
    // ─────────────────────────────────────────────────────────────
    _showPopup(anchorBtn, cfg) {
        // 先关闭已有弹窗
        if (this._activePopup) {
            this._hidePopup();
        }

        this._activePopup = cfg.name;
        this._popupAnchor = anchorBtn;

        // 标记触发按钮为展开状态
        if (anchorBtn.hasAttribute('aria-expanded')) {
            anchorBtn.setAttribute('aria-expanded', 'true');
        }

        // 清除弹窗内容
        while (this._popup.firstChild) {
            this._popup.removeChild(this._popup.firstChild);
        }

        // 无障碍：将弹窗标记为对话框
        this._popup.setAttribute('role', 'dialog');
        this._popup.setAttribute('aria-label', cfg.label);

        // 标题
        const title = document.createElement('div');
        title.className = 'rt-popup-title';
        title.textContent = cfg.label;
        this._popup.appendChild(title);

        // 构建控件
        const controlResult = this._buildControl(cfg);
        this._popup.appendChild(controlResult.container);

        // 操作按钮
        const actions = document.createElement('div');
        actions.className = 'rt-popup-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'rt-popup-btn';
        cancelBtn.textContent = '取消';
        cancelBtn.setAttribute('aria-label', `取消 ${cfg.label}`);
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._hidePopup();
        });

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'rt-popup-btn rt-popup-btn-primary';
        applyBtn.textContent = '应用';
        applyBtn.setAttribute('aria-label', `应用 ${cfg.label}`);
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = controlResult.getValue();
            if (value === null || value === undefined || value === '') {
                this._showValidationError(controlResult.container, `请输入${cfg.label}的值`);
                return;
            }
            // 如果存在验证器则进行验证
            if (cfg.validator && !cfg.validator(value)) {
                this._showValidationError(controlResult.container, `${cfg.label}的值无效`);
                return;
            }
            if (cfg.type === 'self-closing') {
                const openTag = typeof cfg.open === 'function' ? cfg.open(value) : cfg.open;
                this._insertAtCursor(openTag);
            } else {
                this._applyValueTag(cfg, value);
            }
            this.updateOutput();
            this._hidePopup();
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(applyBtn);
        this._popup.appendChild(actions);

        // 定位弹窗
        this._popup.style.display = 'block';
        this._positionPopup(anchorBtn);

        // 监听外部点击
        setTimeout(() => {
            document.addEventListener('click', this._onDocClickBound, true);
        }, 0);

        // 聚焦第一个输入框
        const firstInput = this._popup.querySelector('input, select');
        if (firstInput) firstInput.focus();

        // 允许回车键应用
        this._popup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyBtn.click();
            } else if (e.key === 'Escape') {
                this._hidePopup();
            }
        });
    }

    _positionPopup(anchorBtn) {
        const rect = anchorBtn.getBoundingClientRect();
        const popupRect = this._popup.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 4;
        let left = rect.left + window.scrollX;

        // 保持在视口范围内
        if (left + popupRect.width > window.innerWidth - 8) {
            left = window.innerWidth - popupRect.width - 8;
        }
        if (left < 8) left = 8;
        if (top + popupRect.height > window.innerHeight + window.scrollY - 8) {
            top = rect.top + window.scrollY - popupRect.height - 4;
        }

        this._popup.style.top = top + 'px';
        this._popup.style.left = left + 'px';
    }

    _hidePopup() {
        // 重置触发按钮的 aria-expanded
        if (this._popupAnchor && this._popupAnchor.hasAttribute('aria-expanded')) {
            this._popupAnchor.setAttribute('aria-expanded', 'false');
        }
        const returnFocusTo = this._popupAnchor;

        this._popup.style.display = 'none';
        this._activePopup = null;
        this._popupAnchor = null;
        document.removeEventListener('click', this._onDocClickBound, true);
        // 清除内容
        while (this._popup.firstChild) {
            this._popup.removeChild(this._popup.firstChild);
        }
        // 将焦点返回给触发按钮
        if (returnFocusTo && returnFocusTo.focus) {
            returnFocusTo.focus();
        }
    }

    _onDocumentClick(e) {
        if (!this._popup || this._popup.style.display === 'none') return;
        if (this._popup.contains(e.target)) return;
        if (this._popupAnchor && this._popupAnchor.contains(e.target)) return;
        this._hidePopup();
    }

    _showValidationError(container, message) {
        let errorEl = container.querySelector('.rt-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'rt-error';
            container.appendChild(errorEl);
        }
        errorEl.textContent = message;
    }

    // ─────────────────────────────────────────────────────────────
    //  可视化控件
    // ─────────────────────────────────────────────────────────────

    /**
     * 根据标签配置构建对应的控件。
     * 返回 { container: HTMLElement, getValue: () => string }
     */
    _buildControl(cfg) {
        switch (cfg.control) {
            case 'color':       return this._buildColorControl(cfg);
            case 'alpha':       return this._buildAlphaControl(cfg);
            case 'mark':        return this._buildMarkControl(cfg);
            case 'number-unit': return this._buildNumberUnitControl(cfg);
            case 'dropdown':    return this._buildDropdownControl(cfg);
            case 'text':        return this._buildTextControl(cfg);
            default:            return this._buildTextControl(cfg);
        }
    }

    // ── 颜色选择器控件 ──
    _buildColorControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};
        let currentColor = opts.default || '#FF0000';

        // 行：颜色输入框 + 十六进制文本
        const row = document.createElement('div');
        row.className = 'rt-control-row';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = currentColor;
        colorInput.className = 'rt-color-input';

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = currentColor;
        hexInput.className = 'rt-text-input rt-hex-input';
        hexInput.maxLength = 7;

        colorInput.addEventListener('input', () => {
            currentColor = colorInput.value;
            hexInput.value = currentColor;
        });

        hexInput.addEventListener('input', () => {
            const v = hexInput.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                currentColor = v;
                colorInput.value = v;
            }
        });

        row.appendChild(colorInput);
        row.appendChild(hexInput);
        container.appendChild(row);

        // 预设颜色
        const presets = [
            '#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00FFFF',
            '#0088FF', '#0000FF', '#8800FF', '#FF00FF', '#FFFFFF',
            '#888888', '#000000', '#FF4444', '#FFAA44', '#FFFF44',
            '#44FF44', '#44FFFF', '#4444FF', '#AA44FF', '#FF44AA',
        ];
        const presetRow = document.createElement('div');
        presetRow.className = 'rt-color-presets';
        presets.forEach(c => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'rt-color-swatch';
            swatch.style.backgroundColor = c;
            swatch.title = c;
            swatch.addEventListener('click', (e) => {
                e.preventDefault();
                currentColor = c;
                colorInput.value = c;
                hexInput.value = c;
            });
            presetRow.appendChild(swatch);
        });
        container.appendChild(presetRow);

        // 也允许通过文本输入命名颜色
        const namedHint = document.createElement('div');
        namedHint.className = 'rt-hint';
        namedHint.textContent = 'Or type a named color (e.g. red, blue)';
        container.appendChild(namedHint);

        return {
            container,
            getValue: () => {
                const v = hexInput.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
                if (/^[a-zA-Z]+$/.test(v)) return v;
                return currentColor;
            }
        };
    }

    // ── 透明度滑块控件 ──
    _buildAlphaControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};
        let alphaVal = opts.default !== undefined ? opts.default : 255;

        const row = document.createElement('div');
        row.className = 'rt-control-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(opts.min || 0);
        slider.max = String(opts.max || 255);
        slider.value = String(alphaVal);
        slider.className = 'rt-slider';

        const valDisplay = document.createElement('input');
        valDisplay.type = 'text';
        valDisplay.value = alphaVal.toString(16).toUpperCase().padStart(2, '0');
        valDisplay.className = 'rt-text-input rt-alpha-val';
        valDisplay.maxLength = 2;

        const preview = document.createElement('div');
        preview.className = 'rt-alpha-preview';
        preview.style.opacity = String(alphaVal / 255);
        preview.textContent = '预览文本';

        slider.addEventListener('input', () => {
            alphaVal = parseInt(slider.value, 10);
            valDisplay.value = alphaVal.toString(16).toUpperCase().padStart(2, '0');
            preview.style.opacity = String(alphaVal / 255);
        });

        valDisplay.addEventListener('input', () => {
            const hex = valDisplay.value.trim();
            if (/^[0-9A-Fa-f]{1,2}$/.test(hex)) {
                alphaVal = parseInt(hex, 16);
                slider.value = String(alphaVal);
                preview.style.opacity = String(alphaVal / 255);
            }
        });

        row.appendChild(slider);
        row.appendChild(valDisplay);
        container.appendChild(row);
        container.appendChild(preview);

        return {
            container,
            getValue: () => alphaVal.toString(16).toUpperCase().padStart(2, '0')
        };
    }

    // ── 高亮标记控件（颜色 + 透明度组合）──
    _buildMarkControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};
        let currentColor = opts.defaultColor || '#FFFF00';
        let alphaVal = opts.defaultAlpha !== undefined ? opts.defaultAlpha : 170;

        // 颜色行
        const colorRow = document.createElement('div');
        colorRow.className = 'rt-control-row';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = currentColor;
        colorInput.className = 'rt-color-input';

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = currentColor;
        hexInput.className = 'rt-text-input rt-hex-input';
        hexInput.maxLength = 7;

        colorInput.addEventListener('input', () => {
            currentColor = colorInput.value;
            hexInput.value = currentColor;
        });
        hexInput.addEventListener('input', () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
                currentColor = hexInput.value;
                colorInput.value = currentColor;
            }
        });

        colorRow.appendChild(colorInput);
        colorRow.appendChild(hexInput);
        container.appendChild(colorRow);

        // 预设颜色
        const presets = [
            '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#FF8800',
            '#FF00FF', '#00FFFF', '#FFFFFF', '#888888', '#000000',
        ];
        const presetRow = document.createElement('div');
        presetRow.className = 'rt-color-presets';
        presets.forEach(c => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'rt-color-swatch';
            swatch.style.backgroundColor = c;
            swatch.title = c;
            swatch.addEventListener('click', (e) => {
                e.preventDefault();
                currentColor = c;
                colorInput.value = c;
                hexInput.value = c;
            });
            presetRow.appendChild(swatch);
        });
        container.appendChild(presetRow);

        // 透明度行
        const alphaLabel = document.createElement('div');
        alphaLabel.className = 'rt-control-label';
        alphaLabel.textContent = 'Opacity';
        container.appendChild(alphaLabel);

        const alphaRow = document.createElement('div');
        alphaRow.className = 'rt-control-row';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '255';
        slider.value = String(alphaVal);
        slider.className = 'rt-slider';

        const alphaDisplay = document.createElement('span');
        alphaDisplay.className = 'rt-alpha-display';
        alphaDisplay.textContent = alphaVal.toString(16).toUpperCase().padStart(2, '0');

        slider.addEventListener('input', () => {
            alphaVal = parseInt(slider.value, 10);
            alphaDisplay.textContent = alphaVal.toString(16).toUpperCase().padStart(2, '0');
        });

        alphaRow.appendChild(slider);
        alphaRow.appendChild(alphaDisplay);
        container.appendChild(alphaRow);

        // 预览
        const preview = document.createElement('div');
        preview.className = 'rt-mark-preview';
        const labelSpan = document.createElement('span');
        labelSpan.textContent = 'Highlighted ';
        preview.appendChild(labelSpan);
        const previewMark = document.createElement('span');
        previewMark.textContent = 'text sample';
        previewMark.style.backgroundColor = currentColor + alphaVal.toString(16).toUpperCase().padStart(2, '0');
        preview.appendChild(previewMark);
        container.appendChild(preview);

        // 变化时更新预览
        const updatePreview = () => {
            previewMark.style.backgroundColor = currentColor + alphaVal.toString(16).toUpperCase().padStart(2, '0');
        };
        colorInput.addEventListener('input', updatePreview);
        hexInput.addEventListener('input', updatePreview);
        slider.addEventListener('input', updatePreview);

        return {
            container,
            getValue: () => {
                const hex = /^#[0-9A-Fa-f]{6}$/.test(hexInput.value) ? hexInput.value : currentColor;
                const aHex = alphaVal.toString(16).toUpperCase().padStart(2, '0');
                return hex + aHex;
            }
        };
    }

    // ── 数值 + 单位控件 ──
    _buildNumberUnitControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};
        const units = opts.units || ['px'];
        let currentUnit = opts.defaultUnit || units[0];
        let currentVal = opts.default !== undefined ? opts.default : 0;

        // 数值 + 单位行
        const row = document.createElement('div');
        row.className = 'rt-control-row';

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.value = String(currentVal);
        numInput.className = 'rt-text-input rt-num-input';
        if (opts.min !== undefined) numInput.min = String(opts.min);
        if (opts.max !== undefined) numInput.max = String(opts.max);
        if (opts.step !== undefined) numInput.step = String(opts.step);

        // 构建单位选择器或标签
        let unitSelect = null;
        if (units.length > 1) {
            unitSelect = document.createElement('select');
            unitSelect.className = 'rt-unit-select';
            units.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u;
                opt.textContent = u;
                if (u === currentUnit) opt.selected = true;
                unitSelect.appendChild(opt);
            });
            unitSelect.addEventListener('change', () => {
                currentUnit = unitSelect.value;
            });
        }

        // 将数值输入框和单位选择器/标签添加到行
        row.appendChild(numInput);
        if (unitSelect) {
            row.appendChild(unitSelect);
        } else if (units.length === 1) {
            const unitLabel = document.createElement('span');
            unitLabel.className = 'rt-unit-label';
            unitLabel.textContent = units[0];
            row.appendChild(unitLabel);
        }
        container.appendChild(row);

        // 构建滑块（用 let 声明以便 numInput 处理器引用）
        let slider = null;
        if (opts.min !== undefined && opts.max !== undefined) {
            slider = document.createElement('input');
            slider.type = 'range';
            slider.min = String(opts.min);
            slider.max = String(opts.max);
            slider.step = String(opts.step || 1);
            slider.value = String(currentVal);
            slider.className = 'rt-slider';

            slider.addEventListener('input', () => {
                currentVal = parseFloat(slider.value);
                numInput.value = String(currentVal);
            });

            container.appendChild(slider);
        }

        // 绑定数值输入框 → 滑块同步（在滑块定义之后）
        numInput.addEventListener('input', () => {
            currentVal = parseFloat(numInput.value) || 0;
            if (slider) {
                const clamped = Math.min(Math.max(currentVal, parseFloat(slider.min)), parseFloat(slider.max));
                slider.value = String(clamped);
            }
        });

        return {
            container,
            getValue: () => {
                const v = parseFloat(numInput.value);
                if (isNaN(v)) return null;
                return v + currentUnit;
            }
        };
    }

    // ── 下拉选择控件 ──
    _buildDropdownControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};
        const choices = opts.choices || [];

        const select = document.createElement('select');
        select.className = 'rt-dropdown';
        choices.forEach(ch => {
            const opt = document.createElement('option');
            opt.value = ch.value;
            opt.textContent = ch.label;
            if (ch.value === opts.default) opt.selected = true;
            select.appendChild(opt);
        });
        container.appendChild(select);

        return {
            container,
            getValue: () => select.value
        };
    }

    // ── 文本输入控件 ──
    _buildTextControl(cfg) {
        const container = document.createElement('div');
        container.className = 'rt-control';
        const opts = cfg.controlOptions || {};

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'rt-text-input rt-text-full';
        textInput.placeholder = opts.placeholder || 'Enter value...';
        container.appendChild(textInput);

        return {
            container,
            getValue: () => textInput.value.trim()
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  样式应用引擎
    // ─────────────────────────────────────────────────────────────

    /**
     * 应用带可选参数值的标签。
     * 公开 API 兼容方法。
     */
    applyStyle(tagName, value) {
        const cfg = this.TAG_CONFIG[tagName];
        if (!cfg) return;

        if (cfg.type === 'toggle') {
            this._applyToggle(cfg);
        } else if (cfg.type === 'self-closing') {
            const openTag = typeof cfg.open === 'function' ? cfg.open(value) : cfg.open;
            this._insertAtCursor(openTag);
        } else {
            this._applyValueTag(cfg, value);
        }
        this.updateOutput();
    }

    /**
     * 切换包裹型标签：如果选中文本已被包裹，则解除包裹；否则进行包裹。
     */
    _applyToggle(cfg) {
        const { selectionStart: start, selectionEnd: end, value: fullText } = this.textarea;
        let newStart = start;
        let newEnd = end;

        // 无选区时，移动光标到末尾
        if (newStart === newEnd) {
            // 插入占位文字用于包裹
            const placeholder = 'text';
            const openTag = typeof cfg.open === 'function' ? cfg.open() : cfg.open;
            const closeTag = cfg.close;
            const insertion = openTag + placeholder + closeTag;
            this._insertAtCursor(insertion);
            // 选中占位文本
            const cursorPos = this.textarea.selectionStart;
            this.selectTextRange(this.textarea, cursorPos - closeTag.length - placeholder.length, cursorPos - closeTag.length);
            this.updateOutput();
            return;
        }

        const selectedText = fullText.substring(newStart, newEnd);
        const beforeText = fullText.substring(0, newStart);
        const afterText = fullText.substring(newEnd);
        const openTag = typeof cfg.open === 'function' ? cfg.open() : cfg.open;
        const closeTag = cfg.close;

        // 检查是否已被包裹 — 同时检查选区前后的文本
        const escapedOpen = this.escapeRegExp(openTag);
        const escapedClose = this.escapeRegExp(closeTag);
        const wrapRegex = new RegExp(`${escapedOpen}([\\s\\S]*?)${escapedClose}`, 's');

        if (wrapRegex.test(selectedText)) {
            // 解除包裹：移除外层匹配的标签
            const unwrapped = selectedText.replace(wrapRegex, '$1');
            this.textarea.value = beforeText + unwrapped + afterText;
            const diff = unwrapped.length - selectedText.length;
            this.selectTextRange(this.textarea, newStart, newEnd + diff);
        } else {
            // 检查周围文本是否包含该标签
            const beforeOpen = beforeText.lastIndexOf(openTag);
            const afterClose = afterText.indexOf(closeTag);
            if (beforeOpen !== -1 && afterClose !== -1) {
                // 移除周围标签
                const newBefore = beforeText.substring(0, beforeOpen) + beforeText.substring(beforeOpen + openTag.length);
                const newAfter = afterText.substring(0, afterClose) + afterText.substring(afterClose + closeTag.length);
                this.textarea.value = newBefore + selectedText + newAfter;
                const adjustStart = newStart - openTag.length;
                this.selectTextRange(this.textarea, adjustStart, adjustStart + selectedText.length);
            } else {
                // 包裹
                const wrapped = openTag + selectedText + closeTag;
                this.textarea.value = beforeText + wrapped + afterText;
                this.selectTextRange(this.textarea, newStart + openTag.length, newEnd + openTag.length);
            }
        }
        this.updateOutput();
    }

    /**
     * 用带值的标签包裹选中文本。
     */
    _applyValueTag(cfg, value) {
        const { selectionStart: start, selectionEnd: end, value: fullText } = this.textarea;
        let newStart = start;
        let newEnd = end;

        if (newStart === newEnd) {
            // 无选区 — 包裹占位文本
            const placeholder = 'text';
            const openTag = typeof cfg.open === 'function' ? cfg.open(value) : cfg.open;
            const closeTag = cfg.close;
            const insertion = openTag + placeholder + closeTag;
            this._insertAtCursor(insertion);
            const cursorPos = this.textarea.selectionStart;
            this.selectTextRange(this.textarea, cursorPos - closeTag.length - placeholder.length, cursorPos - closeTag.length);
            return;
        }

        const selectedText = fullText.substring(newStart, newEnd);
        const beforeText = fullText.substring(0, newStart);
        const afterText = fullText.substring(newEnd);
        const openTag = typeof cfg.open === 'function' ? cfg.open(value) : cfg.open;
        const closeTag = cfg.close;

        const wrapped = openTag + selectedText + closeTag;
        this.textarea.value = beforeText + wrapped + afterText;
        this.selectTextRange(this.textarea, newStart + openTag.length, newEnd + openTag.length);
    }

    /**
     * 在当前光标位置插入文本。
     */
    _insertAtCursor(text) {
        const { selectionStart: start, selectionEnd: end, value: fullText } = this.textarea;
        const beforeText = fullText.substring(0, start);
        const afterText = fullText.substring(end);
        this.textarea.value = beforeText + text + afterText;
        const newPos = start + text.length;
        this.selectTextRange(this.textarea, newPos, newPos);
    }

    // ─────────────────────────────────────────────────────────────
    //  清除所有格式
    // ─────────────────────────────────────────────────────────────
    clearAllFormat() {
        const { selectionStart: start, selectionEnd: end, value: fullText } = this.textarea;
        const isFullText = (start === end);
        const targetText = isFullText ? fullText : fullText.substring(start, end);

        // 构建匹配所有已知 Unity 富文本标签的正则
        const tagNames = Object.keys(this.TAG_CONFIG);
        const tagPattern = tagNames.map(t => this.escapeRegExp(t)).join('|');
        // 匹配开标签（带或不带属性）、闭标签和自闭合标签
        const regex = new RegExp(
            `</?(?:${tagPattern})(?:\\s[^>]*)?\\/?>`, 'gi'
        );
        const cleanedText = targetText.replace(regex, '');

        this.textarea.value = isFullText
            ? cleanedText
            : fullText.substring(0, start) + cleanedText + fullText.substring(end);

        if (!isFullText) {
            const newEnd = start + cleanedText.length;
            this.selectTextRange(this.textarea, start, newEnd);
        }
        this.updateOutput();
    }

    // ─────────────────────────────────────────────────────────────
    //  预览 / 输出
    // ─────────────────────────────────────────────────────────────
    updateOutput() {
        // 优雅处理空文本框
        let text = this.textarea.value;
        if (!text) {
            this.preview.innerHTML = '';
            return;
        }

        // 首先转义 HTML 实体以防止 XSS
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 处理 Unity 标签 — 匹配转义后的形式（&lt;tag&gt;）
        let htmlText = text

        // 将换行符转换为 <br>（在标签处理之后）
            .replace(/\r?\n/g, '<br>')
            // 自闭合：<space=X>
            .replace(/&lt;space=([\d.]+)(px|em|%)&gt;/gi, (_, val, unit) => {
                const emVal = unit === 'em' ? parseFloat(val) : parseFloat(val) * 0.06;
                return `<span style="display:inline-block;width:${emVal}em">&nbsp;</span>`;
            })
            .replace(/&lt;pos=[^&]*&gt;/gi, '<span style="border-left:1px dashed #888;margin:0 2px"></span>')
            .replace(/&lt;sprite\s+name="([^"]*)"&gt;/gi,
                '<span style="display:inline-block;background:#555;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px">🖼 $1</span>')

        // 切换型标签
            .replace(/&lt;b&gt;/gi, '<strong>').replace(/&lt;\/b&gt;/gi, '</strong>')
            .replace(/&lt;i&gt;/gi, '<em>').replace(/&lt;\/i&gt;/gi, '</em>')
            .replace(/&lt;u&gt;/gi, '<span style="text-decoration:underline">').replace(/&lt;\/u&gt;/gi, '</span>')
            .replace(/&lt;s&gt;/gi, '<span style="text-decoration:line-through">').replace(/&lt;\/s&gt;/gi, '</span>')
            .replace(/&lt;sub&gt;/gi, '<sub>').replace(/&lt;\/sub&gt;/gi, '</sub>')
            .replace(/&lt;sup&gt;/gi, '<sup>').replace(/&lt;\/sup&gt;/gi, '</sup>')
            // 文本变换标签
            .replace(/&lt;allcaps&gt;/gi, '<span style="text-transform:uppercase">').replace(/&lt;\/allcaps&gt;/gi, '</span>')
            .replace(/&lt;lowercase&gt;/gi, '<span style="text-transform:lowercase">').replace(/&lt;\/lowercase&gt;/gi, '</span>')
            .replace(/&lt;uppercase&gt;/gi, '<span style="text-transform:uppercase">').replace(/&lt;\/uppercase&gt;/gi, '</span>')
            .replace(/&lt;smallcaps&gt;/gi, '<span style="font-variant:small-caps">').replace(/&lt;\/smallcaps&gt;/gi, '</span>')
            .replace(/&lt;nobr&gt;/gi, '<span style="white-space:nowrap">').replace(/&lt;\/nobr&gt;/gi, '</span>')
            .replace(/&lt;noparse&gt;/gi, '<code style="background:#333;padding:1px 4px;border-radius:2px">').replace(/&lt;\/noparse&gt;/gi, '</code>')

        // 颜色
            .replace(/&lt;color=(#[0-9A-Fa-f]{6}|[a-zA-Z]+)&gt;/gi, '<span style="color:$1">')
            .replace(/&lt;\/color&gt;/gi, '</span>')
            // 透明度
            .replace(/&lt;alpha=#([0-9A-Fa-f]{2})&gt;/gi, (_, hex) => {
                const opacity = (parseInt(hex, 16) / 255).toFixed(2);
                return `<span style="opacity:${opacity}">`;
            })
            .replace(/&lt;\/alpha&gt;/gi, '</span>')
            // 高亮标记
            .replace(/&lt;mark=(#[0-9A-Fa-f]{8})&gt;/gi, '<span style="background-color:$1">')
            .replace(/&lt;\/mark&gt;/gi, '</span>')

        // 字号
            .replace(/&lt;size=([\d.]+)(px|%|em)?&gt;/gi, (_, size, unit) => {
                unit = unit || 'px';
                let cssSize;
                if (unit === '%') cssSize = (parseFloat(size) / 5) + 'px';
                else if (unit === 'em') cssSize = size + 'em';
                else cssSize = size + 'px';
                return `<span style="font-size:${cssSize}">`;
            })
            .replace(/&lt;\/size&gt;/gi, '</span>')

        // 字重
            .replace(/&lt;font-weight="?(\d+)"?&gt;/gi, '<span style="font-weight:$1">')
            .replace(/&lt;\/font-weight&gt;/gi, '</span>')
            // 字体
            .replace(/&lt;font="([^"]*)"&gt;/gi, '<span style="font-family:$1">')
            .replace(/&lt;\/font&gt;/gi, '</span>')
            // 对齐
            .replace(/&lt;align="?([^"]*)"?&gt;/gi, '<div style="text-align:$1">')
            .replace(/&lt;\/align&gt;/gi, '</div>')

        // 间距与布局标签
            .replace(/&lt;cspace=([^&]*)&gt;/gi, '<span title="character-spacing: $1">')
            .replace(/&lt;\/cspace&gt;/gi, '</span>')
            .replace(/&lt;mspace=([^&]*)&gt;/gi, '<span style="display:inline-block;width:$1" title="monospace: $1">')
            .replace(/&lt;\/mspace&gt;/gi, '</span>')
            .replace(/&lt;indent=([^&]*)&gt;/gi, '<div style="padding-left:$1" title="indent: $1">')
            .replace(/&lt;\/indent&gt;/gi, '</div>')
            .replace(/&lt;line-height=([^&]*)&gt;/gi, '<span title="line-height: $1">')
            .replace(/&lt;\/line-height&gt;/gi, '</span>')
            .replace(/&lt;line-indent=([^&]*)&gt;/gi, '<span title="line-indent: $1">')
            .replace(/&lt;\/line-indent&gt;/gi, '</span>')
            .replace(/&lt;margin=([^&]*)&gt;/gi, '<div style="margin-left:$1;margin-right:$1" title="margin: $1">')
            .replace(/&lt;\/margin&gt;/gi, '</div>')
            .replace(/&lt;voffset=([^&]*)&gt;/gi, '<span style="vertical-align:$1" title="voffset: $1">')
            .replace(/&lt;\/voffset&gt;/gi, '</span>')
            .replace(/&lt;width=([^&]*)&gt;/gi, '<div style="max-width:$1;display:inline-block" title="width: $1">')
            .replace(/&lt;\/width&gt;/gi, '</div>')

        // 渐变
            .replace(/&lt;gradient="([^"]*)"&gt;/gi,
                '<span style="background:linear-gradient(90deg,#4af,#a4f);-webkit-background-clip:text;-webkit-text-fill-color:transparent" title="gradient: $1">')
            .replace(/&lt;\/gradient&gt;/gi, '</span>')
            // 样式类
            .replace(/&lt;style="([^"]*)"&gt;/gi, '<span class="rt-style-$1" title="style: $1">')
            .replace(/&lt;\/style&gt;/gi, '</span>')
            // 链接
            .replace(/&lt;link="?([^"]*)"?&gt;/gi,
                '<a href="#" onclick="return false" style="color:#5b9bd5;text-decoration:underline" title="link: $1">')
            .replace(/&lt;\/link&gt;/gi, '</a>')
            // A（网页链接）
            .replace(/&lt;a href="([^"]*)"&gt;/gi,
                '<a href="$1" target="_blank" rel="noopener" style="color:#5b9bd5;text-decoration:underline">')
            .replace(/&lt;\/a&gt;/gi, '</a>')
            // 双空格
            .replace(/  /g, '&nbsp;&nbsp;');

        this.preview.innerHTML = htmlText;
    }

    // ─────────────────────────────────────────────────────────────
    //  事件
    // ─────────────────────────────────────────────────────────────
    _bindEvents() {
        // 保存绑定引用以便 destroy() 中清理
        this._debounceTimer = null;
        this._onInput = () => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.updateOutput(), 150);
        };
        this._onKeydown = (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); this._applyToggle(this.TAG_CONFIG.b); break;
                    case 'i': e.preventDefault(); this._applyToggle(this.TAG_CONFIG.i); break;
                    case 'u': e.preventDefault(); this._applyToggle(this.TAG_CONFIG.u); break;
                }
            }
        };
        this.textarea.addEventListener('input', this._onInput);
        this.textarea.addEventListener('keydown', this._onKeydown);
    }

    // ─────────────────────────────────────────────────────────────
    //  工具方法
    // ─────────────────────────────────────────────────────────────
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    selectTextRange(element, start, end) {
        element.focus();
        element.setSelectionRange(start, end);
    }

    // ─────────────────────────────────────────────────────────────
    //  CSS 注入
    // ─────────────────────────────────────────────────────────────
    _injectStyles() {
        const styleId = 'hurichtext-styles';
        if (document.getElementById(styleId)) return;

        const css = `
/* ═══════════════════════════════════════════════
   HURichTextEditor — Unity 富文本可视化编辑器
   ═══════════════════════════════════════════════ */

/* ── 工具栏 ── */
.rich-text-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 6px 8px;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    margin-bottom: -1px;
    position: relative;
    z-index: 1;
}

.rt-group-label {
    font-size: 9px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 0 3px;
    white-space: nowrap;
    align-self: center;
}

.rt-separator {
    width: 1px;
    height: 22px;
    background: #ddd;
    margin: 0 3px;
    flex-shrink: 0;
}

/* ── 工具栏按钮 ── */
.rt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 5px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    transition: background 0.12s, border-color 0.12s, transform 0.08s;
    position: relative;
    flex-shrink: 0;
}
.rt-btn:hover {
    background: #f0f0f0;
    border-color: #ddd;
}
.rt-btn:active {
    background: #e0e0e0;
    transform: scale(0.95);
}
.rt-btn-danger {
    color: #e05555;
}
.rt-btn-danger:hover {
    background: rgba(224, 85, 85, 0.08);
    border-color: rgba(224, 85, 85, 0.2);
}

/* ── 弹窗 ── */
.rt-popup {
    position: absolute;
    z-index: 100000;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    min-width: 260px;
    max-width: 340px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: rt-popup-in 0.14s ease-out;
}
@keyframes rt-popup-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

.rt-popup-title {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #eee;
}

.rt-popup-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #eee;
}

.rt-popup-btn {
    padding: 5px 14px;
    border-radius: 4px;
    border: 1px solid #ddd;
    background: transparent;
    color: #555;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.12s;
}
.rt-popup-btn:hover {
    background: #f5f5f5;
}
.rt-popup-btn-primary {
    background: #5b9bd5;
    color: #fff;
    border-color: #5b9bd5;
    font-weight: 600;
}
.rt-popup-btn-primary:hover {
    background: #4a8ac4;
    border-color: #4a8ac4;
}

/* ── 控件 ── */
.rt-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.rt-control-row {
    display: flex;
    gap: 8px;
    align-items: center;
}
.rt-control-label {
    font-size: 11px;
    color: #888;
    margin-top: 4px;
}

.rt-text-input {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #333;
    padding: 5px 8px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.15s;
}
.rt-text-input:focus {
    border-color: #5b9bd5;
}
.rt-hex-input { width: 80px; font-family: 'SF Mono', 'Consolas', monospace; }
.rt-num-input { width: 72px; }
.rt-alpha-val { width: 40px; font-family: 'SF Mono', 'Consolas', monospace; text-align: center; }
.rt-text-full { width: 100%; box-sizing: border-box; }

.rt-unit-select {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #333;
    padding: 5px 6px;
    font-size: 12px;
    outline: none;
    cursor: pointer;
}
.rt-unit-select:focus { border-color: #5b9bd5; }

.rt-unit-label {
    font-size: 12px;
    color: #888;
    padding: 0 4px;
    min-width: 24px;
}

.rt-dropdown {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: #333;
    padding: 5px 8px;
    font-size: 12px;
    width: 100%;
    outline: none;
    cursor: pointer;
}
.rt-dropdown:focus { border-color: #5b9bd5; }

.rt-slider {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: #e0e0e0;
    border-radius: 3px;
    outline: none;
    cursor: pointer;
}
.rt-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #5b9bd5;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.rt-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #5b9bd5;
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

/* ── 颜色选择器 ── */
.rt-color-input {
    width: 40px;
    height: 32px;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px;
    cursor: pointer;
    background: #fafafa;
}

.rt-color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
}

.rt-color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.12s, transform 0.08s;
    padding: 0;
}
.rt-color-swatch:hover {
    border-color: #5b9bd5;
    transform: scale(1.15);
}

/* ── 透明度预览 ── */
.rt-alpha-preview {
    background: repeating-conic-gradient(#e0e0e0 0% 25%, #f5f5f5 0% 50%) 50% / 12px 12px;
    color: #333;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    transition: opacity 0.15s;
}

.rt-alpha-display {
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 12px;
    color: #888;
    min-width: 28px;
    text-align: center;
}

/* ── 高亮预览 ── */
.rt-mark-preview {
    background: #f5f5f5;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    color: #333;
    text-align: center;
}

/* ── 错误 ── */
.rt-error {
    color: #e05555;
    font-size: 11px;
    margin-top: 4px;
    padding: 4px 6px;
    background: rgba(224, 85, 85, 0.08);
    border-radius: 3px;
}

/* ── 提示 ── */
.rt-hint {
    font-size: 10px;
    color: #aaa;
    margin-top: 2px;
}

/* ── 预览 ── */
.rich-text-preview {
    padding: 16px;
    border: 1px solid #e0e0e0;
    border-radius: 0 0 6px 6px;
    background: #fafafa;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    min-height: 100px;
    overflow-y: auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
}
.rich-text-preview:empty::before {
    content: '预览内容将显示在此处...';
    color: #bbb;
    font-style: italic;
}
.rich-text-preview a {
    color: #5b9bd5;
}
`;

        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }

    // ─────────────────────────────────────────────────────────────
    //  静态工厂方法
    // ─────────────────────────────────────────────────────────────
    static create(selector, previewSelector, options = null) {
        return new HURichTextEditor(selector, previewSelector, options);
    }
}
