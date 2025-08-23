import { useState, useRef } from 'react';
import { Button } from './Button';

interface ImageUploadProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (imageData: ImageData) => void;
}

interface ImageData {
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export function ImageUpload({ visible, onClose, onInsert }: ImageUploadProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageAlt, setImageAlt] = useState<string>('');
  const [imageCaption, setImageCaption] = useState<string>('');
  const [imageWidth, setImageWidth] = useState<number>(400);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      
      // 立即生成预览URL，不需要额外的上传步骤
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // 自动设置alt文本
      setImageAlt(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUrlInput = (url: string) => {
    setImageUrl(url);
    if (url && !imageAlt) {
      // 从URL中提取文件名作为alt文本
      const filename = url.split('/').pop()?.split('?')[0] || '';
      setImageAlt(filename.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleInsert = () => {
    if (!imageUrl) return;

    const imageData: ImageData = {
      url: imageUrl,
      alt: imageAlt || '实验图片',
      caption: imageCaption,
      width: imageWidth
    };

    onInsert(imageData);
    handleClose();
  };

  const handleClose = () => {
    setSelectedImage(null);
    setImageUrl('');
    setImageAlt('');
    setImageCaption('');
    setImageWidth(400);
    setUploadMethod('file');
    onClose();
  };

  // 移除模拟上传函数，因为现在选择文件后立即生成预览

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                <i className="fa-solid fa-image mr-2 text-green-600"></i>
                插入图片
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                支持实验现象、结果图片和设备照片
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-times text-gray-500"></i>
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：上传方式选择 */}
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  选择图片来源
                </h4>
                
                {/* 上传方式切换 */}
                <div className="flex space-x-2 mb-4">
                  <button
                    onClick={() => setUploadMethod('file')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      uploadMethod === 'file'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <i className="fa-solid fa-upload mr-2"></i>
                    本地上传
                  </button>
                  <button
                    onClick={() => setUploadMethod('url')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      uploadMethod === 'url'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <i className="fa-solid fa-link mr-2"></i>
                    网络链接
                  </button>
                </div>
                
                {/* 文件上传 */}
                {uploadMethod === 'file' && (
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {selectedImage && imageUrl ? (
                        <div className="space-y-2">
                          <i className="fa-solid fa-check-circle text-4xl text-green-500 mb-2"></i>
                          <p className="text-green-600 dark:text-green-400 font-medium">
                            文件已选择: {selectedImage.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            点击重新选择文件
                          </p>
                        </div>
                      ) : (
                        <div>
                          <i className="fa-solid fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            点击选择图片文件
                          </p>
                          <p className="text-sm text-gray-500">
                            支持 JPG、PNG、GIF 格式，最大 10MB
                          </p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}
                
                {/* URL输入 */}
                {uploadMethod === 'url' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        图片链接
                      </label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => handleUrlInput(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    
                    {/* 示例图片链接 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        或选择示例图片：
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          {
                            url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&h=300&fit=crop',
                            name: '实验室设备'
                          },
                          {
                            url: 'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?w=400&h=300&fit=crop',
                            name: '化学实验'
                          },
                          {
                            url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop',
                            name: '显微镜图像'
                          }
                        ].map((example, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setImageUrl(example.url);
                              setImageAlt(example.name);
                            }}
                            className="p-2 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                          >
                            <span className="text-blue-600 dark:text-blue-400">{example.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 图片信息设置 */}
              <div className="space-y-4">
                <h5 className="font-medium text-gray-800 dark:text-white">
                  图片信息
                </h5>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    替代文本 (必填)
                  </label>
                  <input
                    type="text"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    placeholder="描述图片内容，用于无障碍访问"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    图片说明 (可选)
                  </label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="如：实验反应过程中的颜色变化"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    显示宽度 (px)
                  </label>
                  <div className="flex space-x-2">
                    {[300, 400, 500, 600].map(width => (
                      <button
                        key={width}
                        onClick={() => setImageWidth(width)}
                        className={`px-3 py-1 rounded text-sm transition-all ${
                          imageWidth === width
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {width}px
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={imageWidth}
                    onChange={(e) => setImageWidth(Number(e.target.value))}
                    min="100"
                    max="800"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
            
            {/* 右侧：预览区域 */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                预览
              </h4>
              
              {imageUrl ? (
                <div className="space-y-4">
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <img
                      src={imageUrl}
                      alt={imageAlt}
                      style={{ width: `${imageWidth}px`, maxWidth: '100%', height: 'auto' }}
                      className="mx-auto rounded shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xODAgMTIwSDIyMFYxODBIMTgwVjEyMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHA+PGZpbGw9IiM2QjcyODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjUwMCI+CjwvZz4KPC9zdmc+';
                      }}
                    />
                    {imageCaption && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2 italic">
                        {imageCaption}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Markdown 预览
                    </h6>
                    <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
{`![${imageAlt}](${imageUrl}${imageWidth !== 400 ? ` =x${imageWidth}` : ''})${imageCaption ? `\n*${imageCaption}*` : ''}`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center h-64 flex items-center justify-center">
                  <div>
                    <i className="fa-solid fa-image text-4xl text-gray-400 mb-4"></i>
                    <p className="text-gray-500 dark:text-gray-400">
                      选择图片后将在此处显示预览
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {imageUrl && `图片大小: ${imageWidth}px 宽`}
          </div>
          <div className="flex space-x-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleClose}
            >
              <i className="fa-solid fa-times mr-2"></i>
              取消
            </Button>
            <Button 
              type="button"
              onClick={handleInsert}
              disabled={!imageUrl || !imageAlt}
              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              <i className="fa-solid fa-check mr-2"></i>
              插入图片
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}