interface PopupContents {
    title: string;
}

export default function Popup({ title }: PopupContents) {
    return (
        <div className="fixed top-0 bottom-0 left-0 right-0 bg-black/30 backdrop-blur-md flex justify-center items-center z-50">
            <div className="bg-white px-6 py-4 rounded-xl flex flex-col gap-4">
                <p className="text-lg">{title}</p>
                <div className="flex items-center justify-between gap-4">
                    <button className="bg-red-400 text-white px-4 py-2 rounded-md w-full">Cancel</button>
                    <button className="bg-green-500 text-white px-4 py-2 rounded-md w-full">Ok</button>
                </div>
            </div>
        </div>
    )
}