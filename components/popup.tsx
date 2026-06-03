"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface PopupContents {
    title: string;
    onClose?: () => void;
    onConfirm?: () => void;
    type?: "info" | "success" | "warning" | "error";
}

export default function Popup({ title, onClose, onConfirm, type = "info" }: PopupContents) {
    const colors = {
        info: "text-primary bg-primary/10",
        success: "text-emerald-500 bg-emerald-500/10",
        warning: "text-amber-500 bg-amber-500/10",
        error: "text-destructive bg-destructive/10",
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-md shadow-2xl border border-border rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className={`p-2 rounded-lg ${colors[type]}`}>
                            {type === "success" ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <button 
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <h3 className="text-xl font-bold text-foreground mb-2">Confirmation</h3>
                    <p className="text-muted-foreground">{title}</p>
                </div>

                <div className="bg-muted/50 p-4 flex items-center justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:translate-y-[-1px]"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    )
}
