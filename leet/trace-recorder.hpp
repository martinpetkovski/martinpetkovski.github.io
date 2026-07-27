#pragma once

#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdlib>
#include <fstream>
#include <new>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace LeetTrace
{
	struct alignas(std::max_align_t) AllocationHeader
	{
		std::size_t Size;
		bool bTracked;
	};

	inline std::atomic<long long>& GetLiveHeapBytes()
	{
		static std::atomic<long long> LiveHeapBytes = 0;
		return LiveHeapBytes;
	}

	inline bool& IsHeapTrackingEnabled()
	{
		static thread_local bool bIsEnabled = false;
		return bIsEnabled;
	}
}

void* operator new(std::size_t Size)
{
	const std::size_t AllocationSize = Size > 0 ? Size : 1;
	LeetTrace::AllocationHeader* Header = static_cast<LeetTrace::AllocationHeader*>(
		std::malloc(sizeof(LeetTrace::AllocationHeader) + AllocationSize));

	if (!Header)
		throw std::bad_alloc();

	Header->Size = AllocationSize;
	Header->bTracked = LeetTrace::IsHeapTrackingEnabled();

	if (Header->bTracked)
		LeetTrace::GetLiveHeapBytes().fetch_add(static_cast<long long>(AllocationSize));

	return Header + 1;
}

void* operator new[](std::size_t Size)
{
	return ::operator new(Size);
}

void operator delete(void* Pointer) noexcept
{
	if (!Pointer)
		return;

	LeetTrace::AllocationHeader* Header = static_cast<LeetTrace::AllocationHeader*>(Pointer) - 1;

	if (Header->bTracked)
		LeetTrace::GetLiveHeapBytes().fetch_sub(static_cast<long long>(Header->Size));

	std::free(Header);
}

void operator delete[](void* Pointer) noexcept
{
	::operator delete(Pointer);
}

void operator delete(void* Pointer, std::size_t) noexcept
{
	::operator delete(Pointer);
}

void operator delete[](void* Pointer, std::size_t) noexcept
{
	::operator delete(Pointer);
}

namespace LeetTrace
{
	using TraceClock = std::chrono::steady_clock;

	inline std::string EscapeJson(const std::string& Value)
	{
		std::string Result;

		for (const char Character : Value)
		{
			switch (Character)
			{
			case '\\':
				Result += "\\\\";
				break;
			case '"':
				Result += "\\\"";
				break;
			case '\n':
				Result += "\\n";
				break;
			case '\r':
				Result += "\\r";
				break;
			case '\t':
				Result += "\\t";
				break;
			default:
				Result += Character;
				break;
			}
		}

		return Result;
	}

	inline std::string ToText(bool Value)
	{
		return Value ? "true" : "false";
	}

	inline std::string ToText(char Value)
	{
		return std::string("'") + Value + "'";
	}

	inline std::string ToText(const std::string& Value)
	{
		return "\"" + Value + "\"";
	}

	template <typename ValueType>
	std::string ToText(const ValueType& Value)
	{
		std::ostringstream Stream;
		Stream << Value;
		return Stream.str();
	}

	template <typename ValueType>
	std::string ToText(const std::vector<ValueType>& Values)
	{
		std::string Result = "[";

		for (int Index = 0; Index < static_cast<int>(Values.size()); Index++)
		{
			if (Index > 0)
				Result += ", ";

			Result += ToText(Values[Index]);
		}

		Result += "]";
		return Result;
	}

	template <typename KeyType, typename ValueType>
	std::string ToText(const std::unordered_map<KeyType, ValueType>& Values)
	{
		std::string Result = "{";
		bool bIsFirst = true;

		for (const std::pair<const KeyType, ValueType>& Entry : Values)
		{
			if (!bIsFirst)
				Result += ", ";

			Result += ToText(Entry.first) + ": " + ToText(Entry.second);
			bIsFirst = false;
		}

		Result += "}";
		return Result;
	}

	inline std::ofstream& GetOutput()
	{
		static std::ofstream Output([]()
		{
			const char* Path = std::getenv("LEET_TRACE_OUTPUT");
			return Path ? Path : "execution-traces.ndjson";
		}(), std::ios::app);
		return Output;
	}

	inline std::string& GetSolution()
	{
		static std::string Solution;
		return Solution;
	}

	inline std::string& GetCase()
	{
		static std::string Case;
		return Case;
	}

	inline int& GetStep()
	{
		static int Step = 0;
		return Step;
	}

	inline TraceClock::time_point& GetLastStepTime()
	{
		static TraceClock::time_point LastStepTime;
		return LastStepTime;
	}

	inline long long& GetLastHeapBytes()
	{
		static long long LastHeapBytes = 0;
		return LastHeapBytes;
	}

	inline void Begin(const std::string& Solution, const std::string& Case)
	{
		IsHeapTrackingEnabled() = false;
		GetSolution() = Solution;
		GetCase() = Case;
		GetStep() = 0;
		GetLiveHeapBytes().store(0);
		GetLastHeapBytes() = 0;
		GetLastStepTime() = TraceClock::now();
		IsHeapTrackingEnabled() = true;
	}

	inline void End()
	{
		IsHeapTrackingEnabled() = false;
	}

	inline void AppendVariables(std::ofstream&, bool&)
	{
	}

	template <typename ValueType, typename... RemainingTypes>
	void AppendVariables(
		std::ofstream& Output,
		bool& bIsFirst,
		const char* Name,
		const ValueType& Value,
		RemainingTypes&&... Remaining)
	{
		if (!bIsFirst)
			Output << ",";

		Output << "\"" << EscapeJson(Name) << "\":\"" << EscapeJson(ToText(Value)) << "\"";
		bIsFirst = false;
		AppendVariables(Output, bIsFirst, std::forward<RemainingTypes>(Remaining)...);
	}

	template <typename... ValueTypes>
	void Record(int Line, const char* Statement, ValueTypes&&... Values)
	{
		const TraceClock::time_point CapturedAt = TraceClock::now();
		const long long DurationNs = std::chrono::duration_cast<std::chrono::nanoseconds>(
			CapturedAt - GetLastStepTime()).count();
		const long long HeapBytes = GetLiveHeapBytes().load();
		const long long HeapDeltaBytes = HeapBytes - GetLastHeapBytes();
		IsHeapTrackingEnabled() = false;
		std::ofstream& Output = GetOutput();
		bool bIsFirst = true;

		Output << "{\"solution\":\"" << EscapeJson(GetSolution())
			<< "\",\"case\":\"" << EscapeJson(GetCase())
			<< "\",\"step\":" << GetStep()
			<< ",\"line\":" << Line
			<< ",\"durationNs\":" << DurationNs
			<< ",\"heapBytes\":" << HeapBytes
			<< ",\"heapDeltaBytes\":" << HeapDeltaBytes
			<< ",\"statement\":\"" << EscapeJson(Statement)
			<< "\",\"variables\":{";
		AppendVariables(Output, bIsFirst, std::forward<ValueTypes>(Values)...);
		Output << "}}\n";
		Output.flush();
		GetLastStepTime() = TraceClock::now();
		GetLastHeapBytes() = HeapBytes;
		GetStep()++;
		IsHeapTrackingEnabled() = true;
	}
}
