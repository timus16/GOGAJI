import re 
with open('E:/sentir/gogaji/GOGAJI/src/components/Generator.tsx', 'r') as f: 
    content = f.read() 
content = content.replace('[&::', '[AMP::') 
