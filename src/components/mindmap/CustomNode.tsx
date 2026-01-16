import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import clsx from 'clsx';

// Organic 有机自然主题色映射
const typeColors = {
    project: {
        bg: 'bg-moss/15',
        border: 'border-moss',
        text: 'text-loam',
        icon: 'text-moss'
    },
    record: {
        bg: 'bg-terracotta/15',
        border: 'border-terracotta',
        text: 'text-loam',
        icon: 'text-terracotta'
    },
    note: {
        bg: 'bg-sand/30',
        border: 'border-bark/50',
        text: 'text-loam',
        icon: 'text-bark'
    },
    sop: {
        bg: 'bg-timber-soft',
        border: 'border-bark/40',
        text: 'text-loam',
        icon: 'text-grass'
    },
    default: {
        bg: 'bg-organic-rice-paper',
        border: 'border-bark/20',
        text: 'text-loam',
        icon: 'text-grass'
    }
};

const typeIcons = {
    project: 'fa-cubes',
    record: 'fa-flask',
    note: 'fa-sticky-note',
    sop: 'fa-file-alt',
    default: 'fa-circle'
};

const CustomNode = ({ data }: NodeProps) => {
    const nodeType = (data.type as keyof typeof typeColors) || 'default';
    const styles = typeColors[nodeType] || typeColors.default;
    const icon = typeIcons[nodeType as keyof typeof typeIcons] || typeIcons.default;

    // 判断是否是根节点（项目节点）
    const isRoot = nodeType === 'project';

    return (
        <div className={clsx(
            "px-4 py-3 rounded-xl shadow-organic border-2 transition-all duration-natural min-w-[150px]",
            styles.bg,
            styles.border,
            isRoot ? "border-2 shadow-lg" : "border"
        )}>
            {/* 输入连接点 */}
            {!isRoot && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="w-3 h-3 !bg-timber-soft !border-2 !border-organic-rice-paper"
                />
            )}

            <div className="flex items-center gap-3">
                <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center bg-organic-rice-paper shadow-sm ring-1 ring-inset",
                    isRoot ? "ring-moss/30" : "ring-bark/20"
                )}>
                    <i className={clsx("fa-solid text-sm", icon, styles.icon)}></i>
                </div>

                <div className="flex flex-col">
                    <div className={clsx(
                        "font-medium leading-tight",
                        styles.text,
                        isRoot ? "text-base" : "text-sm"
                    )}>
                        {data.label}
                    </div>
                    {data.subLabel && (
                        <div className="text-[10px] text-grass mt-0.5">
                            {data.subLabel}
                        </div>
                    )}
                </div>
            </div>

            {childrenNodes(data)}

            {/* 输出连接点 */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 !bg-timber-soft !border-2 !border-organic-rice-paper"
            />
        </div>
    );
};

// 辅助函数：如果有子节点统计信息
const childrenNodes = (data: any) => {
    if (!data.stats) return null;

    return (
        <div className="flex gap-2 mt-2 pt-2 border-t border-bark/10">
            {Object.entries(data.stats).map(([key, value]) => (
                <div key={key} className="text-[10px] text-grass flex items-center gap-1">
                    {/* 这里可以加图标 */}
                    <span>{String(value)}</span>
                </div>
            ))}
        </div>
    );
};

export default memo(CustomNode);
