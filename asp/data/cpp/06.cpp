#include<iostream>
#include"util\util.h"
using namespace std;

void insertion_sort(int niza[], dword n)
{
	for (dword i = 1; i < n; i++) {
		int element = niza[i];
		dword j = i;
		while (j > 0 && niza[j - 1] > element) {
			niza[j] = niza[j - 1];
			j--;
		}
		niza[j] = element;
	}
}