/*
 * title: Two Sum
 * statement:
 * Given an integer array nums and an integer target, return the indices of the two numbers whose sum equals target.
 * Each input has exactly one solution, and the same element cannot be used twice.
 * The indices may be returned in any order.
 *
 * leetcode: https://leetcode.com/problems/two-sum/
 * difficulty: Easy
 * tags: Array, Hash Table
 * time: O(n)
 * space: O(n)
 * note:
 */

#include <unordered_map>
#include <vector>

class Solution
{
public:
	std::vector<int> twoSum(std::vector<int>& Nums, int Target)
	{
		std::vector<int> Result;
		std::unordered_map<int, int> Indices;

		for (int Index = 0; Index < static_cast<int>(Nums.size()) && Result.empty(); Index++)
		{
			const int Complement = Target - Nums[Index];
			const std::unordered_map<int, int>::const_iterator Match = Indices.find(Complement);

			if (Match != Indices.end())
				Result = { Match->second, Index };
			else
				Indices[Nums[Index]] = Index;
		}

		return Result;
	}
};
