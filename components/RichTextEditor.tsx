"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Minimal TipTap wrapper for structured nurse notes — bold/italic/lists only,
// matching how much formatting the spec actually asks for.
export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[7rem] px-4 py-3 text-sm text-foreground focus:outline-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const toolbarButton = (
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void
  ) => (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="rounded-xl border border-input bg-card overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {toolbarButton("Bold", <Bold size={15} />, editor.isActive("bold"), () =>
          editor.chain().focus().toggleBold().run()
        )}
        {toolbarButton("Italic", <Italic size={15} />, editor.isActive("italic"), () =>
          editor.chain().focus().toggleItalic().run()
        )}
        {toolbarButton("Bullet list", <List size={15} />, editor.isActive("bulletList"), () =>
          editor.chain().focus().toggleBulletList().run()
        )}
        {toolbarButton("Numbered list", <ListOrdered size={15} />, editor.isActive("orderedList"), () =>
          editor.chain().focus().toggleOrderedList().run()
        )}
      </div>
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
