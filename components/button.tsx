interface ButtonType {
    content: string;
}

export default function Button({content}: ButtonType) {
    return (
        <button>{content}</button>
    )
}