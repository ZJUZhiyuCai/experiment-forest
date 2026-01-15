import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import clsx from 'clsx';

// Morandi 主题色映射
const typeColors = {
    project: {
        bg: 'bg-forest-secondary/10',
        border: 'border-forest-primary',
        text: 'text-forest-primary',
        icon: 'text-forest-secondary'
    },
    record: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-500',
        text: 'text-emerald-700',
        icon: 'text-emerald-500'
    },
    note: {
        bg: 'bg-orange-50',
        border: 'border-orange-400',
        text: 'text-orange-700',
        icon: 'text-orange-500'
    },
    sop: {
        bg: 'bg-blue-50',
        border: 'border-blue-400',
        text: 'text-blue-700',
        icon: 'text-blue-500'
    },
    default: {
        bg: 'bg-white',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: 'text-gray-400'
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
            "px-4 py-3 rounded-xl shadow-sm border-2 transition-all duration-200 min-w-[150px]",
            styles.bg,
            styles.border,
            isRoot ? "border-2 shadow-md" : "border"
        )}>
            {/* 输入连接点 */}
            {!isRoot && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="w-3 h-3 !bg-gray-300 !border-2 !border-white"
                />
            )}

            <div className="flex items-center gap-3">
                <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm ring-1 ring-inset",
                    isRoot ? "ring-forest-secondary/20" : "ring-gray-100"
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
                        <div className="text-[10px] text-gray-500 mt-0.5">
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
                className="w-3 h-3 !bg-gray-300 !border-2 !border-white"
            />
        </div>
    );
};

// 辅助函数：如果有子节点统计信息
const childrenNodes = (data: any) => {
    if (!data.stats) return null;

    return (
        <div className="flex gap-2 mt-2 pt-2 border-t border-black/5">
            {Object.entries(data.stats).map(([key, value]) => (
                <div key={key} className="text-[10px] text-gray-400 flex items-center gap-1">
                    {/* 这里可以加图标 */}
                    <span>{String(value)}</span>
                </div>
            ))}
        </div>
    );
};

export default memo(CustomNode);
