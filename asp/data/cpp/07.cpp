#include<iostream>
#include"util\util.h"
using namespace std;

void bubble_sort(int niza[], dword n)
{
	for (dword i = 0; i < (n - 1); i++)
		for (dword j = 0; j < n - i - 1; j++)
			if (niza[j] > niza[j + 1])
				swap(niza[j], niza[j + 1]);
}