// Package chatwire shapes agent chat protobuf events into the JSON payloads
// sent to webui clients. Shaping (decode, normalize, trim) happens exactly once
// at ingress so every subscriber observes identical bytes.
package chatwire

import (
	"encoding/json"
	"strings"

	gatewayv1 "github.com/liveagent/agent-gateway/internal/proto/v1"
)

// EventPayload shapes a ChatEvent into a wire payload, decoding the JSON data
// blob and trimming oversized tool content.
func EventPayload(event *gatewayv1.ChatEvent, seq int64, workdirInput ...string) map[string]any {
	protoType := EventTypeName(event.GetType())
	payload := map[string]any{
		"type": protoType,
	}
	if seq > 0 {
		payload["seq"] = seq
	}
	if len(workdirInput) > 0 {
		if workdir := strings.TrimSpace(workdirInput[0]); workdir != "" {
			payload["workdir"] = workdir
		}
	}

	raw := strings.TrimSpace(event.GetData())
	if raw == "" {
		raw = "{}"
	}

	var decoded map[string]any
	if err := json.Unmarshal([]byte(raw), &decoded); err == nil {
		for key, value := range decoded {
			payload[key] = value
		}
	}

	if conversationID := strings.TrimSpace(event.GetConversationId()); conversationID != "" {
		payload["conversation_id"] = conversationID
	}

	TrimLargeToolContent(payload, protoType)

	return payload
}

const toolContentMaxChars = 200

var toolFieldsToTrim = map[string][]string{
	"Write":        {"content"},
	"Edit":         {"old_string", "new_string"},
	"NotebookEdit": {"new_source"},
}

// TrimLargeToolContent truncates oversized tool arguments/results in place,
// attaching a __liveagent_stream_preview meta block describing the original size.
func TrimLargeToolContent(payload map[string]any, protoType string) {
	eventType, _ := payload["type"].(string)

	if eventType == "tool_call" || eventType == "tool_call_delta" ||
		protoType == "tool_call" || protoType == "tool_call_delta" {
		trimToolCallPayload(payload)
		return
	}
	if eventType == "tool_result" || protoType == "tool_result" {
		trimToolResultPayload(payload)
	}
}

func trimToolCallPayload(payload map[string]any) {
	toolName := firstString(payload["name"], payload["tool_name"])
	fields, ok := toolFieldsToTrim[toolName]
	if !ok {
		return
	}

	args := firstMap(payload["arguments"], payload["input"], payload["args"])
	if args == nil {
		args = tryParseJSONStringArg(payload, "arguments", "input", "args")
		if args == nil {
			return
		}
	}

	for _, field := range fields {
		trimStringFieldWithPreview(args, field, toolContentMaxChars)
	}
}

func tryParseJSONStringArg(payload map[string]any, keys ...string) map[string]any {
	for _, key := range keys {
		s, ok := payload[key].(string)
		if !ok || s == "" {
			continue
		}
		var parsed map[string]any
		if err := json.Unmarshal([]byte(s), &parsed); err == nil && len(parsed) > 0 {
			payload[key] = parsed
			return parsed
		}
	}
	return nil
}

func trimToolResultPayload(payload map[string]any) {
	switch content := payload["content"].(type) {
	case string:
		if len(content) > toolContentMaxChars {
			lines := countLines(content)
			payload["content"] = content[:toolContentMaxChars]
			ensurePreviewMeta(payload, "content", len(content), lines, true)
		}
	case []any:
		for _, item := range content {
			block, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if text, ok := block["text"].(string); ok && len(text) > toolContentMaxChars {
				lines := countLines(text)
				block["text"] = text[:toolContentMaxChars]
				ensurePreviewMeta(block, "text", len(text), lines, true)
			}
		}
	}
}

func trimStringFieldWithPreview(args map[string]any, field string, maxChars int) {
	text, ok := args[field].(string)
	if !ok || len(text) <= maxChars {
		return
	}
	lines := countLines(text)
	args[field] = text[:maxChars]
	ensurePreviewMeta(args, field, len(text), lines, true)
}

func ensurePreviewMeta(container map[string]any, fieldName string, chars int, lines int, truncated bool) {
	const metaKey = "__liveagent_stream_preview"
	meta, _ := container[metaKey].(map[string]any)
	if meta == nil {
		meta = map[string]any{}
		container[metaKey] = meta
	}
	fields, _ := meta["fields"].(map[string]any)
	if fields == nil {
		fields = map[string]any{}
		meta["fields"] = fields
	}
	fields[fieldName] = map[string]any{
		"chars":     chars,
		"lines":     lines,
		"truncated": truncated,
	}
}

func countLines(s string) int {
	if len(s) == 0 {
		return 0
	}
	n := 1
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			n++
		} else if s[i] == '\r' {
			n++
			if i+1 < len(s) && s[i+1] == '\n' {
				i++
			}
		}
	}
	return n
}

func firstString(candidates ...any) string {
	for _, c := range candidates {
		if s, ok := c.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func firstMap(candidates ...any) map[string]any {
	for _, c := range candidates {
		if m, ok := c.(map[string]any); ok && len(m) > 0 {
			return m
		}
	}
	return nil
}

// EventTypeName maps the protobuf ChatEvent type enum to its wire name.
func EventTypeName(eventType gatewayv1.ChatEvent_ChatEventType) string {
	switch eventType {
	case gatewayv1.ChatEvent_TOKEN:
		return "token"
	case gatewayv1.ChatEvent_THINKING:
		return "thinking"
	case gatewayv1.ChatEvent_TOOL_CALL:
		return "tool_call"
	case gatewayv1.ChatEvent_TOOL_RESULT:
		return "tool_result"
	case gatewayv1.ChatEvent_DONE:
		return "done"
	case gatewayv1.ChatEvent_ERROR:
		return "error"
	case gatewayv1.ChatEvent_TOOL_STATUS:
		return "tool_status"
	case gatewayv1.ChatEvent_HOSTED_SEARCH:
		return "hosted_search"
	case gatewayv1.ChatEvent_USER_MESSAGE:
		return "user_message"
	default:
		return "message"
	}
}
