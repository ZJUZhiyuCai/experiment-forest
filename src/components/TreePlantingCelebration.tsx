import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TreePlantingCelebrationProps {
  isVisible: boolean;
  type: 'record' | 'note' | 'sop';
  onClose: () => void;
}

export function TreePlantingCelebration({ isVisible, type, onClose }: TreePlantingCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);
  
  const getTreeInfo = () => {
    switch (type) {
      case 'record':
        return {
          icon: 'fa-seedling',
          color: '#7FB069',
          bgColor: 'from-[#A8D5BA]/20 to-[#7FB069]/20',
          title: '🌱 种下了新的幼苗！',
          message: '您的实验记录已经在森林中生根发芽',
          achievement: '播种者'
        };
      case 'note':
        return {
          icon: 'fa-leaf',
          color: '#4A7C59',
          bgColor: 'from-[#7FB069]/20 to-[#4A7C59]/20',
          title: '🍃 枝叶更加茂盛！',
          message: '您的实验笔记为知识之树增添了新的生机',
          achievement: '园丁'
        };
      case 'sop':
        return {
          icon: 'fa-tree',
          color: '#3B82F6',
          bgColor: 'from-blue-500/20 to-cyan-500/20',
          title: '🌳 知识大树初成！',
          message: '您的SOP文档已成为参天大树',
          achievement: '蓝色智慧守护者'
        };
      default:
        return {
          icon: 'fa-seedling',
          color: '#7FB069',
          bgColor: 'from-[#A8D5BA]/20 to-[#7FB069]/20',
          title: '🌱 种下了新的幼苗！',
          message: '森林中又多了一个新成员',
          achievement: '播种者'
        };
    }
  };
  
  const treeInfo = getTreeInfo();
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 10 }}
            transition={{ type: "spring", duration: 0.6 }}
            className={`bg-gradient-to-br ${treeInfo.bgColor} rounded-2xl p-8 max-w-md mx-4 text-center border border-white/20 backdrop-blur-md`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 彩带动画 */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: 12 }, (_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                    }}
                    initial={{ scale: 0, y: 0 }}
                    animate={{ 
                      scale: [0, 1, 0],
                      y: [-20, -60, -100],
                      x: [0, Math.random() * 40 - 20, Math.random() * 80 - 40]
                    }}
                    transition={{ 
                      duration: 2,
                      delay: i * 0.1,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </div>
            )}
            
            {/* 主要树木图标 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", duration: 0.8 }}
              className="mb-6"
            >
              <div className="relative">
                <motion.i
                  className={`fa-solid ${treeInfo.icon} text-6xl`}
                  style={{ color: treeInfo.color }}
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                {/* 种植动画效果 */}
                <motion.div
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-[#8B4513] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: 64 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                />
              </div>
            </motion.div>
            
            {/* 文字内容 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-2xl font-bold text-[#4A7C59] mb-3">
                {treeInfo.title}
              </h2>
              <p className="text-[#666666] mb-6">
                {treeInfo.message}
              </p>
              
              {/* 成就徽章 */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring" }}
                className="inline-flex items-center bg-[#FFD700]/20 border border-[#FFD700]/40 rounded-full px-4 py-2 mb-6"
              >
                <i className="fa-solid fa-award text-[#FFD700] mr-2"></i>
                <span className="text-[#4A7C59] font-medium text-sm">获得成就: {treeInfo.achievement}</span>
              </motion.div>
            </motion.div>
            
            {/* 关闭按钮 */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={onClose}
              className="bg-[#4A7C59] hover:bg-[#7FB069] text-white px-6 py-2 rounded-lg transition-colors"
            >
              继续培育森林 🌲
            </motion.button>
            
            {/* 自动关闭进度条 */}
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-[#4A7C59] rounded-b-2xl"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}