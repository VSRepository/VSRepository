export function uncapitalize(text: string) {
    return text[0] ? text[0].toLowerCase() + text.slice(1, text.length) : "";
}
