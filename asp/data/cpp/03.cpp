#include<iostream>
using namespace std;

int faktoriel_recursive(int n)
{
	if (n == 1)
		return 1;
	else
		return n * faktoriel_recursive(n - 1);
}

int faktoriel_iterative(int n)
{
	int ret = 1;
	for (int i = 1; i <= n; i++)
		ret *= i;
	return ret;
}