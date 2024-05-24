city = input()
s = input().split("; ")
ans = []
for i in s:
    i = i.split(": ")
    print(i[1])
    if city in i[1].split(', '):
        ans.append(i[0])
ans = sorted(ans)
print('; '.join(ans))