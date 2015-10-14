#include<iostream>
#include"util\util.h"
using namespace std;

void insertion_sort(int niza[], dword n)
{
	for (dword i = 0; i < n; i++)
		for (dword j = i; j > 0; j--)
			if (niza[j - 1] > niza[j])
				swap(niza[j], niza[j - 1]);
}