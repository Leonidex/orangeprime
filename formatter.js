function format_ud(entry) {
	var message = '**Term:**\n' + entry.word + '\n\n'
    message += '**Definition:**\n' + entry.definition + '\n\n'
    message += '**Example:**\n' + entry.example
    return message
}