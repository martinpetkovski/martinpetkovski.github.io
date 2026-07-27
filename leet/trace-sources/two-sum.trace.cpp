#include "../trace-recorder.hpp"

#include <unordered_map>
#include <vector>

class Solution
{
public:
	std::vector<int> twoSum(std::vector<int>& Nums, int Target)
	{
		std::vector<int> Result;
		LeetTrace::Record(24, "std::vector<int> Result;", "Nums", Nums, "Target", Target, "Result", Result);
		std::unordered_map<int, int> Indices;
		LeetTrace::Record(25, "std::unordered_map<int, int> Indices;", "Indices", Indices);

		for (int Index = 0; Index < static_cast<int>(Nums.size()) && Result.empty(); Index++)
		{
			LeetTrace::Record(
				27,
				"for (int Index = 0; Index < static_cast<int>(Nums.size()) && Result.empty(); Index++)",
				"Index", Index,
				"Result", Result,
				"Indices", Indices);
			const int Complement = Target - Nums[Index];
			LeetTrace::Record(
				29,
				"const int Complement = Target - Nums[Index];",
				"Index", Index,
				"Nums[Index]", Nums[Index],
				"Complement", Complement);
			const std::unordered_map<int, int>::const_iterator Match = Indices.find(Complement);
			const bool bHasMatch = Match != Indices.end();
			LeetTrace::Record(
				30,
				"const std::unordered_map<int, int>::const_iterator Match = Indices.find(Complement);",
				"Complement", Complement,
				"bHasMatch", bHasMatch);

			if (bHasMatch)
			{
				Result = { Match->second, Index };
				LeetTrace::Record(33, "Result = { Match->second, Index };", "Result", Result);
			}
			else
			{
				Indices[Nums[Index]] = Index;
				LeetTrace::Record(35, "Indices[Nums[Index]] = Index;", "Index", Index, "Indices", Indices);
			}
		}

		LeetTrace::Record(38, "return Result;", "Result", Result);
		return Result;
	}
};
